import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const analyzeContractSchema = z.object({
  pdf_base64: z.string().min(1, "PDF data is required"),
  file_name: z.string().min(1),
  deal_name: z.string().min(1),
  funder_email: z.string().email(),
  contractor_email: z.string().email(),
  jurisdiction: z.string().min(1),
});

function buildPrompt(params: {
  pdfBase64: string;
  dealName: string;
  jurisdiction: string;
}): string {
  return `You are a construction contract analyst. The following is a base64-encoded PDF of a construction contract. Extract the full project milestone structure for use in a payment governance platform.

CONTRACT PDF (base64): ${params.pdfBase64.slice(0, 60000)}${params.pdfBase64.length > 60000 ? "\n[TRUNCATED — analyze available content only]" : ""}

## CONTRACT METADATA
- Project name: ${params.dealName}
- Jurisdiction: ${params.jurisdiction}

## YOUR TASK
Extract from the contract:
1. All project phases or milestones with payment amounts
2. Completion conditions per phase (what must be done/documented before payment)
3. Retainage terms and when released
4. Lien waiver requirements per phase
5. Change order provisions
6. Any ambiguous, missing, or risky clauses

CRITICAL: Return ONLY a valid JSON object. No prose. No markdown. No code fences.

JSON schema:
{
  "milestones": [
    {
      "name": "<phase name from contract>",
      "amount": <number — dollars, no symbols>,
      "conditions": ["<condition 1>", "<condition 2>"],
      "sequence_order": <integer starting at 1>,
      "retainage_pct": <number 0-100>,
      "notes": "<relevant context from contract>",
      "flags": ["<ambiguity or risk>"]
    }
  ],
  "total_value": <total contract value as number>,
  "retainage_summary": "<plain language summary of retainage terms>",
  "missing_clauses": ["<absent or unclear clause>"],
  "recommended_settings": {
    "dispute_isolation": <true|false>,
    "co_gating": <true|false>,
    "retainage_holdback_pct": <number>
  }
}

Rules:
- Use real milestone names from the contract — do not invent generic names
- Amounts must sum to total_value (excluding retainage)
- conditions must include: document requirements, inspection requirements, contractual approvals
- flags must note anything requiring review before approving payment
- If an amount is unclear, use 0 and add a flag
- missing_clauses must include: dispute resolution, retainage release triggers, lien waiver type if unspecified`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication failed");

    const user = userData.user;
    const body = await req.json();

    const validation = analyzeContractSchema.safeParse(body);
    if (!validation.success) {
      return new Response(JSON.stringify({
        error: "Invalid request",
        details: validation.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { pdf_base64, file_name, deal_name, funder_email, contractor_email, jurisdiction } = validation.data;

    // File size guard — base64 is ~4/3 of binary size
    const approxBytes = (pdf_base64.length * 3) / 4;
    if (approxBytes > 20 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File exceeds 20MB limit" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // ── Perplexity API call ───────────────────────────────────────────────────
    const perplexityRes = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("PERPLEXITY_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: "You are a construction contract analyst. Return only valid JSON. Never add prose, markdown, or code fences.",
          },
          {
            role: "user",
            content: buildPrompt({ pdfBase64: pdf_base64, dealName: deal_name, jurisdiction }),
          },
        ],
        max_tokens: 4000,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!perplexityRes.ok) {
      throw new Error(`Perplexity API ${perplexityRes.status}: ${perplexityRes.statusText}`);
    }

    const perplexityData = await perplexityRes.json();
    const rawContent: string = perplexityData.choices?.[0]?.message?.content ?? "";

    const cleaned = rawContent
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(`Failed to parse AI response: ${cleaned.slice(0, 200)}`);
    }

    if (!Array.isArray(parsed.milestones) || (parsed.milestones as unknown[]).length === 0) {
      throw new Error("No milestones could be extracted from the contract");
    }

    const milestones = (parsed.milestones as Record<string, unknown>[]).map((m, i) => ({
      name: String(m.name ?? ""),
      amount: Number(m.amount) || 0,
      conditions: Array.isArray(m.conditions) ? m.conditions as string[] : [],
      sequence_order: Number(m.sequence_order) || i + 1,
      retainage_pct: Number(m.retainage_pct) || 0,
      notes: String(m.notes ?? ""),
      flags: Array.isArray(m.flags) ? m.flags as string[] : [],
    }));

    // Audit log — contract text is NOT stored, only structure
    await supabaseClient.from("audit_log").insert({
      entity_type: "deal",
      entity_id: "00000000-0000-0000-0000-000000000000", // placeholder — no deal created yet
      action: "contract_analyzed_via_ai",
      actor_id: user.id,
      old_values: null,
      new_values: null,
      metadata: {
        file_name,
        deal_name,
        milestone_count: milestones.length,
        total_value: parsed.total_value,
        model: perplexityData.model ?? "sonar-pro",
        missing_clauses_count: Array.isArray(parsed.missing_clauses) ? parsed.missing_clauses.length : 0,
      },
    }).then(() => {}).catch(() => {}); // audit failures are silent

    return new Response(JSON.stringify({
      success: true,
      data: {
        milestones,
        total_value: Number(parsed.total_value) || 0,
        retainage_summary: String(parsed.retainage_summary ?? ""),
        missing_clauses: Array.isArray(parsed.missing_clauses) ? parsed.missing_clauses : [],
        recommended_settings: parsed.recommended_settings ?? {
          dispute_isolation: true,
          co_gating: true,
          retainage_holdback_pct: 10,
        },
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[analyze-contract] error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
