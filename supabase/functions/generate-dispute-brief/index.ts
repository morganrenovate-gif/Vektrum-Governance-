import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const generateDisputeBriefSchema = z.object({
  milestone_id: z.string().uuid(),
  dispute_reason: z.enum([
    "incomplete_documentation",
    "work_not_verified",
    "invoice_amount_mismatch",
    "lien_waiver_missing",
    "change_order_not_approved",
    "other",
  ]),
  dispute_context: z.string().max(500).optional(),
});

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(params: {
  milestoneName: string;
  milestoneAmount: number;
  disputeReason: string;
  disputeContext: string | undefined;
  jurisdiction: string;
  dealTitle: string;
  priorReleases: { name: string; amount: number; released_at: string }[];
  documents: { name: string; url: string }[];
}): string {
  const priorText =
    params.priorReleases.length === 0
      ? "None — this is the first draw on this project."
      : params.priorReleases.map((r) => `- ${r.name}: $${r.amount.toLocaleString()} on ${r.released_at}`).join("\n");

  const docList =
    params.documents.length === 0
      ? "[No documents submitted with this draw package]"
      : params.documents.map((d, i) => `${i + 1}. ${d.name}`).join("\n");

  const reasonLabel = params.disputeReason.replace(/_/g, " ");

  return `You are a neutral construction payment dispute analyst. Your role is fact-finder only — no legal advice, no outcome decisions.

## DISPUTE CONTEXT
- Deal: ${params.dealTitle}
- Milestone: ${params.milestoneName}
- Amount in dispute: $${params.milestoneAmount.toLocaleString()}
- Jurisdiction: ${params.jurisdiction}
- Stated reason: ${reasonLabel}
${params.disputeContext ? `- Additional context: ${params.disputeContext}` : ""}

## PRIOR RELEASE HISTORY
${priorText}

## SUBMITTED DOCUMENTS
${docList}

## YOUR TASK
Acting as a neutral fact-finder:
1. List every item that WAS submitted and whether it meets requirements
2. Identify what is MISSING or non-compliant and why
3. Map each condition to MET / PARTIAL / UNMET
4. Provide numbered resolution steps in plain language the contractor can act on
5. Estimate realistic resolution time
6. Summarize project financial impact (locked vs. continuing)

CRITICAL: Return ONLY a valid JSON object. No prose. No markdown. No code fences.

{
  "submitted_items": [
    { "name": "<item>", "present": <bool>, "detail": "<specific finding>" }
  ],
  "missing_items": [
    { "item": "<missing item>", "requiredBy": "<condition or standard>", "severity": "BLOCKING" | "RECOMMENDED" }
  ],
  "condition_gaps": [
    { "condition": "<exact condition text>", "status": "MET" | "PARTIAL" | "UNMET", "explanation": "<finding>" }
  ],
  "resolution_steps": [
    { "step": <n>, "action": "<actionable step>", "responsibleParty": "CONTRACTOR" | "FUNDER" | "EITHER", "detail": "<context>" }
  ],
  "estimated_resolution_time": "<e.g. 2-3 business days>",
  "project_status_summary": "<amount locked, amount continuing, overall impact>"
}

Rules:
- Be neutral — do not frame in favor of either party
- Reference specific document names and amounts
- BLOCKING = directly prevents a condition from being met
- Resolution steps must be actionable without legal interpretation
- Do not speculate about intent`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

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

    const validation = generateDisputeBriefSchema.safeParse(body);
    if (!validation.success) {
      return new Response(JSON.stringify({
        error: "Invalid request",
        details: validation.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { milestone_id, dispute_reason, dispute_context } = validation.data;

    // ── Fetch milestone + deal ────────────────────────────────────────────────
    // Reconciliation: table is `milestones` (not `project_milestones`);
    //                 relation is `deals!inner` (not `projects!inner`);
    //                 funder is `deals.funder_id` (not `projects.user_id`).
    const { data: milestone, error: msError } = await supabaseClient
      .from("milestones")
      .select("*, deals!inner(id, title, funder_id, contractor_id)")
      .eq("id", milestone_id)
      .single();

    if (msError || !milestone) throw new Error("Milestone not found");

    // Only the funder (deal owner) may trigger a dispute brief
    if (milestone.deals.funder_id !== user.id) {
      return new Response(JSON.stringify({ error: "Only the deal funder can generate a dispute brief" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Prior released milestones on this deal
    const { data: priorReleases } = await supabaseClient
      .from("milestones")
      .select("title, amount, updated_at")
      .eq("deal_id", milestone.deal_id)
      .eq("status", "released")
      .order("updated_at", { ascending: true });

    // Documents submitted with this milestone
    const { data: documents } = await supabaseClient
      .from("milestone_documents")
      .select("file_name, file_url")
      .eq("milestone_id", milestone_id);

    const prompt = buildPrompt({
      milestoneName: milestone.title,
      milestoneAmount: milestone.amount,
      disputeReason: dispute_reason,
      disputeContext: dispute_context,
      jurisdiction: "Unknown", // no jurisdiction field on deals in this schema
      dealTitle: milestone.deals.title,
      priorReleases: (priorReleases ?? []).map((r: Record<string, unknown>) => ({
        name: r.title as string,
        amount: r.amount as number,
        released_at: new Date(r.updated_at as string).toISOString().split("T")[0],
      })),
      documents: (documents ?? []).map((d: Record<string, unknown>) => ({
        name: d.file_name as string,
        url: d.file_url as string,
      })),
    });

    // ── Perplexity API call ───────────────────────────────────────────────────
    const perplexityApiKey = Deno.env.get("PERPLEXITY_API_KEY");
    if (!perplexityApiKey) {
      return new Response(JSON.stringify({ error: "AI dispute brief service is not configured." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 503,
      });
    }

    const perplexityRes = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${perplexityApiKey}`,
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: "You are a neutral construction payment dispute analyst. Return only valid JSON. Never add prose, markdown, or code fences.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 3000,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!perplexityRes.ok) {
      throw new Error(`Perplexity API ${perplexityRes.status}: ${perplexityRes.statusText}`);
    }

    const perplexityData = await perplexityRes.json();
    const rawContent: string = perplexityData.choices?.[0]?.message?.content ?? "";
    const modelVersion: string = perplexityData.model ?? "sonar-pro";

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

    if (!Array.isArray(parsed.resolution_steps)) {
      throw new Error("Response missing required fields");
    }

    // ── Write brief — immutable, never overwrite ──────────────────────────────
    // Reconciliation: column is `deal_id` (not `project_id`).
    const { data: brief, error: briefError } = await supabaseClient
      .from("dispute_briefs")
      .insert({
        milestone_id,
        deal_id: milestone.deal_id,
        dispute_reason,
        dispute_context: dispute_context ?? null,
        submitted_items: parsed.submitted_items ?? [],
        missing_items: parsed.missing_items ?? [],
        condition_gaps: parsed.condition_gaps ?? [],
        resolution_steps: parsed.resolution_steps,
        estimated_resolution_time: parsed.estimated_resolution_time ?? "Unknown",
        project_status_summary: parsed.project_status_summary ?? "",
        status: "OPEN",
        raw_response: rawContent,
        model_version: modelVersion,
      })
      .select("id")
      .single();

    if (briefError) throw new Error(briefError.message);

    // ── Audit log ─────────────────────────────────────────────────────────────
    await supabaseClient.from("audit_log").insert({
      entity_type: "milestone",
      entity_id: milestone_id,
      action: "dispute_brief_generated",
      actor_id: user.id,
      old_values: null,
      new_values: { brief_id: brief.id, dispute_reason },
      metadata: {
        deal_id: milestone.deal_id,
        brief_id: brief.id,
        resolution_steps_count: (parsed.resolution_steps as unknown[]).length,
        missing_items_count: Array.isArray(parsed.missing_items) ? parsed.missing_items.length : 0,
        model: modelVersion,
      },
    }).then(() => {}).catch(() => {}); // audit failures are silent

    // ── Notify contractor ─────────────────────────────────────────────────────
    await supabaseClient.from("notifications").insert({
      user_id: milestone.deals.contractor_id,
      type: "dispute_brief_available",
      title: "Dispute Brief Available",
      message: `A dispute brief has been generated for "${milestone.title}". Review the resolution steps.`,
      related_entity_type: "milestone",
      related_entity_id: milestone_id,
      action_url: `/dashboard/deals/${milestone.deal_id}`,
    }).then(() => {}).catch(() => {}); // notification failures are silent

    return new Response(JSON.stringify({
      success: true,
      brief_id: brief.id,
      data: parsed,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[generate-dispute-brief] error:", error);

    try {
      const reqBody = await req.clone().json().catch(() => ({}));
      await supabaseClient.from("audit_log").insert({
        entity_type: "milestone",
        entity_id: (reqBody as Record<string, string>).milestone_id ?? "00000000-0000-0000-0000-000000000000",
        action: "dispute_brief_failed",
        actor_id: "00000000-0000-0000-0000-000000000000",
        old_values: null,
        new_values: null,
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });
    } catch { /* audit failure is always silent */ }

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
