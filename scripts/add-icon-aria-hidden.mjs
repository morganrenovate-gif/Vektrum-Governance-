/**
 * scripts/add-icon-aria-hidden.mjs
 *
 * One-off codemod that adds aria-hidden="true" to decorative Lucide icons
 * on public marketing pages. An icon is treated as decorative when:
 *   - it does NOT already have an aria-* attribute
 *   - it does NOT already have role="..."
 *
 * Icon-only controls (the mobile-nav hamburger, etc.) already have
 * aria-label on the parent button — we do not touch their icons either way
 * since they live in components excluded from this script's TARGET list.
 *
 * The script targets self-closing JSX usage of Lucide icons by component
 * name. The `LUCIDE` list is the set of icon components imported across
 * the public site. It is intentionally explicit (no "match every <Capital
 * />" heuristic) to avoid touching unrelated components like `<EngagementCard />`.
 *
 * Run: node scripts/add-icon-aria-hidden.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// Public marketing pages we want to harden.
const TARGETS = [
  'src/app/page.tsx',
  'src/app/funders/page.tsx',
  'src/app/contractors/page.tsx',
  'src/app/help/page.tsx',
  'src/app/pricing/page.tsx',
  'src/app/demo/page.tsx',
  'src/app/about/page.tsx',
  'src/app/careers/page.tsx',
  'src/app/founders/page.tsx',
  'src/app/security/page.tsx',
  'src/app/partners/page.tsx',
  'src/app/resources/page.tsx',
  'src/app/resources/construction-dispute-isolation/page.tsx',
]

// Lucide icon component names imported across these files.
// Add new ones here if a page imports an icon not yet covered.
const LUCIDE = [
  'ArrowRight', 'ArrowLeft', 'ArrowDown',
  'Shield', 'ShieldAlert', 'ShieldCheck',
  'CheckCircle2', 'CheckCircle', 'Check',
  'X', 'XCircle',
  'AlertCircle', 'AlertTriangle',
  'BarChart3', 'BarChart',
  'FileText', 'FileBox',
  'Lock', 'LockKeyhole', 'Key',
  'GitBranch',
  'CreditCard',
  'Building2', 'Building',
  'Banknote', 'DollarSign',
  'Clock',
  'Brain',
  'BookOpen',
  'HelpCircle',
  'Users', 'Users2',
  'Zap',
  'Mail', 'Calendar',
  'ExternalLink',
  'Server',
  'Webhook',
  'FlaskConical',
  'Briefcase',
  'Settings',
  'LogOut',
  'Activity',
  'Wifi', 'WifiOff',
  'RefreshCw',
  'Loader2',
  'Eye', 'EyeOff',
  'Scale',
  'BookMarked',
  'Code',
  'Search',
  'Plus', 'Minus',
]

let totalAdded = 0
let totalScanned = 0

for (const rel of TARGETS) {
  const full = resolve(ROOT, rel)
  let src
  try { src = readFileSync(full, 'utf-8') } catch { continue }

  let modified = src
  let added = 0

  for (const name of LUCIDE) {
    // Match a self-closing <Icon ...props /> tag that is NOT followed by
    // any aria-* or role= attribute. We use a non-greedy attribute capture
    // and only insert aria-hidden when none of those exist.
    //
    // Pattern: <Name <attrs> />
    //   - boundary on tag name
    //   - lazy attr capture
    //   - no aria- or role= already in the tag
    //
    // We also skip cases where the props span multiple lines AND already
    // include 'aria-' or 'role=' anywhere in those props.
    const re = new RegExp(
      `<${name}((?:\\s+[a-zA-Z\\-_:]+(?:=(?:"[^"]*"|\\{(?:[^{}]|\\{[^{}]*\\})*\\}))?)*)\\s*/>`,
      'g',
    )
    modified = modified.replace(re, (match, attrs) => {
      if (/\baria-[a-z]+\s*=/.test(attrs) || /\brole\s*=/.test(attrs)) return match
      added++
      return `<${name}${attrs} aria-hidden="true" />`
    })
  }

  if (added > 0) {
    writeFileSync(full, modified, 'utf-8')
    console.log(`  ${rel}: +${added}`)
    totalAdded += added
  }
  totalScanned++
}

console.log(`\n${totalScanned} file(s) scanned, ${totalAdded} aria-hidden inserted.`)
