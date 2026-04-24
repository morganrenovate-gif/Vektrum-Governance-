// ─── Operational Alerting — Slack ─────────────────────────────────────────────
//
// Sends structured Slack alerts for reconciliation issues and cron health events.
// Uses the Slack Incoming Webhooks API with Block Kit for rich, colour-coded messages.
//
// Severity levels:
//   critical — immediate, red sidebar; sent on every occurrence
//   warning  — amber sidebar; de-duplicated by type (at most one per hour per type
//              via the in-process warning-batch Map in notifications.ts)
//
// Transport:
//   POST to SLACK_WEBHOOK_URL with { attachments: [{ color, blocks }] }
//   Retried up to 3 times with exponential backoff (1 s → 2 s → 4 s).
//   Never throws — failures are logged so that callers (cron routes, engine code)
//   are never interrupted by a Slack outage.
//
// ENV:
//   SLACK_WEBHOOK_URL      — Slack Incoming Webhook URL (required for delivery)
//   NEXT_PUBLIC_APP_URL    — base URL for entity deep-links

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning'

export interface AlertPayload {
  /** 'critical' or 'warning' */
  severity:    AlertSeverity
  /** Short title shown in the Slack message header (max ~60 chars) */
  title:       string
  /** One-sentence description of what was detected */
  description: string
  /**
   * Optional entity context — included as a dashboard deep-link button.
   * Pass dealId for deal/milestone-level issues; omit for run-level alerts.
   */
  entityId?:   string
  /** Arbitrary key-value pairs rendered as Slack fields */
  metadata?:   Record<string, string | number | boolean | null | undefined>
}

// ─── Colour constants ─────────────────────────────────────────────────────────

const COLOUR: Record<AlertSeverity, string> = {
  critical: '#EF4444',  // red-500
  warning:  '#F59E0B',  // amber-500
}

const EMOJI: Record<AlertSeverity, string> = {
  critical: '🚨',
  warning:  '⚠️',
}

// ─── Block builders ───────────────────────────────────────────────────────────

function headerBlock(severity: AlertSeverity, title: string) {
  return {
    type: 'header',
    text: {
      type:  'plain_text',
      text:  `${EMOJI[severity]} ${title}`,
      emoji: true,
    },
  }
}

function sectionBlock(text: string) {
  return {
    type: 'section',
    text: { type: 'mrkdwn', text },
  }
}

function fieldsBlock(fields: Record<string, string | number | boolean | null | undefined>) {
  const items = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .slice(0, 10) // Slack max 10 fields per block
    .map(([k, v]) => ({
      type: 'mrkdwn',
      text: `*${k}*\n${String(v ?? '—')}`,
    }))

  if (items.length === 0) return null

  return {
    type:   'section',
    fields: items,
  }
}

function actionsBlock(entityId: string, appUrl: string) {
  const dealUrl = `${appUrl}/dashboard/deals/${entityId}`
  const opsUrl  = `${appUrl}/dashboard/admin/ops`

  return {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: '🔗 View Deal', emoji: true },
        url:  dealUrl,
        style: 'primary',
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: '⚙️ Ops Dashboard', emoji: true },
        url:  opsUrl,
      },
    ],
  }
}

function opsButtonBlock(appUrl: string) {
  return {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: '⚙️ Ops Dashboard', emoji: true },
        url:  `${appUrl}/dashboard/admin/ops`,
        style: 'primary',
      },
    ],
  }
}

function dividerBlock() {
  return { type: 'divider' }
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function postWithRetry(
  url:     string,
  body:    unknown,
  maxAttempts = 3,
  baseDelayMs = 1_000,
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })

      if (res.ok) return

      const text = await res.text().catch(() => '')
      console.warn(
        `[alerts] Slack webhook returned ${res.status} on attempt ${attempt}/${maxAttempts}:`,
        text.slice(0, 200),
      )
    } catch (err) {
      console.warn(
        `[alerts] Slack webhook fetch error on attempt ${attempt}/${maxAttempts}:`,
        err instanceof Error ? err.message : String(err),
      )
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelayMs * Math.pow(2, attempt - 1)),
      )
    }
  }

  console.error('[alerts] Slack alert delivery failed after all retry attempts.')
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Sends a structured Slack alert via an Incoming Webhook.
 *
 * Silently no-ops if SLACK_WEBHOOK_URL is not set (safe for local dev).
 * Never throws.
 */
export async function sendSlackAlert(payload: AlertPayload): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    // Not a warning — operators may intentionally omit Slack in some envs.
    console.log('[alerts] SLACK_WEBHOOK_URL not set — skipping Slack notification')
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vektrum.io'

  try {
    const blocks: unknown[] = [
      headerBlock(payload.severity, payload.title),
      sectionBlock(payload.description),
    ]

    if (payload.metadata && Object.keys(payload.metadata).length > 0) {
      const fb = fieldsBlock(payload.metadata)
      if (fb) blocks.push(fb)
    }

    blocks.push(dividerBlock())

    if (payload.entityId) {
      blocks.push(actionsBlock(payload.entityId, appUrl))
    } else {
      blocks.push(opsButtonBlock(appUrl))
    }

    const slackBody = {
      attachments: [
        {
          color:  COLOUR[payload.severity],
          blocks,
        },
      ],
    }

    await postWithRetry(webhookUrl, slackBody)
  } catch (err) {
    // Top-level guard — postWithRetry should never throw but this is belt-and-suspenders.
    console.error(
      '[alerts] Unexpected error in sendSlackAlert:',
      err instanceof Error ? err.message : String(err),
    )
  }
}
