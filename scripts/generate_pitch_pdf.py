#!/usr/bin/env python3
"""
Vektrum Pitch Deck — PDF generator.

Generates a 7-slide, 16:9 landscape PDF (960×540 pt) that mirrors the web
deck at /src/app/pitch/page.tsx. Pure reportlab — no external assets.

Usage:
    python3 scripts/generate_pitch_pdf.py
    → writes public/vektrum-pitch.pdf
"""

import os
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfbase.pdfmetrics import stringWidth


# ─── Page ─────────────────────────────────────────────────────────────────────
PAGE_W = 960.0
PAGE_H = 540.0

# ─── Colours (match the web deck) ────────────────────────────────────────────
BG         = HexColor('#07091a')
VEKTRUM    = HexColor('#1A3A96')
BLUE_300   = HexColor('#93C5FD')
BLUE_400   = HexColor('#60A5FA')
BLUE_500   = HexColor('#3B82F6')
EMERALD    = HexColor('#34D399')
EMERALD_3  = HexColor('#6EE7B7')
RED        = HexColor('#F87171')
RED_DIM    = HexColor('#B45252')
AMBER      = HexColor('#FBBF24')
PURPLE     = HexColor('#C084FC')


def w(alpha: float) -> Color:
    """White at given alpha — mirrors Tailwind text-white/alpha."""
    return Color(1, 1, 1, alpha=alpha)


def tinted(hex_color: str, alpha: float) -> Color:
    c = HexColor(hex_color)
    r, g, b = c.rgb()
    return Color(r, g, b, alpha=alpha)


# ─── Fonts ───────────────────────────────────────────────────────────────────
F_REG  = 'Helvetica'
F_BOLD = 'Helvetica-Bold'
F_OBL  = 'Helvetica-Oblique'
F_MONO = 'Courier'


# ─── Primitive drawing helpers (top-left origin model) ───────────────────────

def text_at(c, x, top, s, font=F_REG, size=10, color=None):
    y = PAGE_H - top - size * 0.78
    if color is not None:
        c.setFillColor(color)
    c.setFont(font, size)
    c.drawString(x, y, s)

def text_center(c, cx, top, s, font=F_REG, size=10, color=None):
    y = PAGE_H - top - size * 0.78
    if color is not None:
        c.setFillColor(color)
    c.setFont(font, size)
    c.drawCentredString(cx, y, s)

def text_right(c, x, top, s, font=F_REG, size=10, color=None):
    y = PAGE_H - top - size * 0.78
    if color is not None:
        c.setFillColor(color)
    c.setFont(font, size)
    c.drawRightString(x, y, s)

def rect(c, x, top, width, height, fill=None, stroke=None, radius=0, line_width=0.6):
    y = PAGE_H - top - height
    if fill is not None:
        c.setFillColor(fill)
    if stroke is not None:
        c.setStrokeColor(stroke)
        c.setLineWidth(line_width)
    if radius:
        c.roundRect(x, y, width, height, radius,
                    stroke=1 if stroke is not None else 0,
                    fill=1 if fill is not None else 0)
    else:
        c.rect(x, y, width, height,
               stroke=1 if stroke is not None else 0,
               fill=1 if fill is not None else 0)

def line(c, x1, top1, x2, top2, stroke, line_width=0.5):
    c.setStrokeColor(stroke)
    c.setLineWidth(line_width)
    c.line(x1, PAGE_H - top1, x2, PAGE_H - top2)

def wrap(text_str, font, size, max_w):
    words = text_str.split()
    lines, cur = [], []
    for word in words:
        test = ' '.join(cur + [word])
        if stringWidth(test, font, size) <= max_w:
            cur.append(word)
        else:
            if cur:
                lines.append(' '.join(cur))
            cur = [word]
    if cur:
        lines.append(' '.join(cur))
    return lines

def draw_wrapped(c, x, top, s, font, size, color, max_w, line_height=None):
    if line_height is None:
        line_height = size * 1.45
    for i, ln in enumerate(wrap(s, font, size, max_w)):
        text_at(c, x, top + i * line_height, ln, font, size, color)


# ─── Status marks (✓ / — / ✗) ────────────────────────────────────────────────

def mark_tick(c, cx, top):
    cy = PAGE_H - top
    c.setFillColor(tinted('#34D399', 0.14))
    c.circle(cx, cy, 6.5, stroke=0, fill=1)
    c.setStrokeColor(EMERALD)
    c.setLineWidth(1.3)
    c.setLineCap(1); c.setLineJoin(1)
    p = c.beginPath()
    p.moveTo(cx - 2.8, cy)
    p.lineTo(cx - 0.6, cy - 2.2)
    p.lineTo(cx + 3.2, cy + 2.4)
    c.drawPath(p, stroke=1, fill=0)

def mark_cross(c, cx, top):
    cy = PAGE_H - top
    c.setFillColor(tinted('#F87171', 0.08))
    c.circle(cx, cy, 6.5, stroke=0, fill=1)
    c.setStrokeColor(tinted('#F87171', 0.55))
    c.setLineWidth(1.1); c.setLineCap(1)
    c.line(cx - 2.6, cy - 2.6, cx + 2.6, cy + 2.6)
    c.line(cx - 2.6, cy + 2.6, cx + 2.6, cy - 2.6)

def mark_half(c, cx, top):
    cy = PAGE_H - top
    c.setStrokeColor(tinted('#FBBF24', 0.65))
    c.setLineWidth(1.8); c.setLineCap(1)
    c.line(cx - 3, cy, cx + 3, cy)


# ─── Chrome drawn on every slide ─────────────────────────────────────────────

def draw_background(c):
    rect(c, 0, 0, PAGE_W, PAGE_H, fill=BG)

def draw_top_line(c):
    c.setStrokeColor(tinted('#1A3A96', 0.45))
    c.setLineWidth(1.0)
    c.line(0, PAGE_H - 0.5, PAGE_W, PAGE_H - 0.5)

def draw_chrome(c, idx, total, label, show_wordmark=True):
    draw_top_line(c)
    if show_wordmark:
        text_at(c, 32, 22, 'VEKTRUM', F_BOLD, 7.5, w(0.28))
    text_right(c, PAGE_W - 32, 22, label.upper(), F_REG, 7.5, w(0.22))
    text_right(c, PAGE_W - 32, PAGE_H - 26, f'{idx:02d} / {total:02d}', F_MONO, 7.5, w(0.3))

    # progress dots bottom-centre
    n = total
    gap = 4
    dot = 5
    active_w = 14
    total_w = n * dot + (n - 1) * gap + (active_w - dot)
    start_x = (PAGE_W - total_w) / 2
    x = start_x
    base_top = PAGE_H - 22
    for i in range(n):
        if i == idx - 1:
            rect(c, x, base_top, active_w, dot, fill=BLUE_400, radius=2.5)
            x += active_w + gap
        else:
            rect(c, x, base_top, dot, dot, fill=w(0.18), radius=2.5)
            x += dot + gap


def draw_eyebrow(c, x, top, label):
    rect(c, x, top + 3, 14, 3, fill=VEKTRUM, radius=1.5)
    text_at(c, x + 22, top, label.upper(), F_BOLD, 8, VEKTRUM)


# ─────────────────────────────────────────────────────────────────────────────
# SLIDE 1 — HERO
# ─────────────────────────────────────────────────────────────────────────────

def draw_slide_hero(c):
    draw_background(c)

    # Ambient glow (radial fake with two overlapping ellipses)
    c.saveState()
    c.setFillColor(tinted('#1A3A96', 0.12))
    c.ellipse(PAGE_W/2 - 320, PAGE_H/2 - 220, PAGE_W/2 + 320, PAGE_H/2 + 220,
              stroke=0, fill=1)
    c.setFillColor(tinted('#1A3A96', 0.10))
    c.ellipse(PAGE_W/2 - 220, PAGE_H/2 - 140, PAGE_W/2 + 220, PAGE_H/2 + 140,
              stroke=0, fill=1)
    c.restoreState()

    # Top & bottom hairlines
    c.setStrokeColor(tinted('#1A3A96', 0.45)); c.setLineWidth(1)
    c.line(0, PAGE_H - 0.5, PAGE_W, PAGE_H - 0.5)
    c.setStrokeColor(w(0.06))
    c.line(0, 0.5, PAGE_W, 0.5)

    cx = PAGE_W / 2

    # Series badge — pill
    badge_text = 'SERIES A  ·  CONSTRUCTION FINANCE INFRASTRUCTURE'
    bw = stringWidth(badge_text, F_BOLD, 7.5) + 40
    bh = 20
    bx = cx - bw / 2
    by = 72
    rect(c, bx, by, bw, bh, fill=tinted('#1A3A96', 0.10),
         stroke=tinted('#1A3A96', 0.35), radius=10, line_width=0.8)
    # pulse dot
    c.setFillColor(BLUE_400)
    c.circle(bx + 12, PAGE_H - by - 10, 2.2, stroke=0, fill=1)
    text_at(c, bx + 20, by + 6, badge_text, F_BOLD, 7.5, VEKTRUM)

    # Wordmark
    text_center(c, cx, 118, 'VEKTRUM', F_BOLD, 9.5, w(0.32))

    # Main headline — two lines
    text_center(c, cx, 150, 'The Release Gate', F_BOLD, 52, w(0.98))
    text_center(c, cx, 208, 'for Construction Capital', F_BOLD, 52, BLUE_300)

    # Deck
    sub = ("Programmable escrow with a 10-condition server-side release gate.\n"
           "Vektrum is the trust infrastructure between funders and contractors — "
           "automating draws without compromising compliance.")
    lines = []
    for part in sub.split('\n'):
        lines.extend(wrap(part, F_REG, 12, 560))
    y_top_sub = 290
    for i, ln in enumerate(lines):
        text_center(c, cx, y_top_sub + i * 18, ln, F_REG, 12, w(0.58))

    # Stat strip
    stats = [
        ('$1.8T',   'US construction lending'),
        ('10',      'Server-side release conditions'),
        ('45 → 2',  'Days per draw cycle'),
    ]
    sw = 170; gap = 12
    total_w = len(stats) * sw + (len(stats) - 1) * gap
    sx0 = cx - total_w / 2
    sy = 370
    for i, (val, sub_s) in enumerate(stats):
        x = sx0 + i * (sw + gap)
        rect(c, x, sy, sw, 66, fill=w(0.025), stroke=w(0.08), radius=12)
        text_center(c, x + sw/2, sy + 14, val, F_BOLD, 26, w(0.97))
        text_center(c, x + sw/2, sy + 46, sub_s, F_REG, 9, w(0.45))

    # Confidential footer
    text_center(c, cx, 478, 'CONFIDENTIAL  ·  NOT FOR DISTRIBUTION  ·  2026',
                F_REG, 7.5, w(0.25))


# ─────────────────────────────────────────────────────────────────────────────
# SLIDE 2 — PROBLEM
# ─────────────────────────────────────────────────────────────────────────────

def draw_slide_problem(c):
    draw_background(c)
    draw_chrome(c, 2, 7, 'Problem')

    # Ambient glow top-right
    c.setFillColor(tinted('#1A3A96', 0.10))
    c.ellipse(PAGE_W - 200, PAGE_H - 40, PAGE_W + 200, PAGE_H + 280, stroke=0, fill=1)

    left_pad = 72

    draw_eyebrow(c, left_pad, 72, 'THE PROBLEM')

    text_at(c, left_pad, 100, 'Construction finance has', F_BOLD, 38, w(0.96))
    text_at(c, left_pad, 140, 'a trust problem.',         F_BOLD, 38, w(0.4))

    for i, ln in enumerate(wrap(
        'The $1.8T construction lending market runs on manual processes, '
        'misaligned incentives, and zero enforcement infrastructure.',
        F_REG, 11.5, 520)):
        text_at(c, left_pad, 200 + i * 17, ln, F_REG, 11.5, w(0.5))

    # Three problem cards
    cards = [
        {
            'stat': '$13B+',
            'meta': 'lost annually to draw fraud',
            'title': 'No enforcement layer',
            'body': ('Draw requests move through email threads and PDFs. '
                     'Anyone can request a release — there is no programmatic gate.'),
            'border': tinted('#F87171', 0.18),
            'stat_color': RED,
            'icon_bg': tinted('#F87171', 0.08),
        },
        {
            'stat': '45 days',
            'meta': 'average draw cycle time',
            'title': 'Broken process',
            'body': ('Funders, inspectors, and title companies pass documents in circles '
                     'with no shared source of truth.'),
            'border': tinted('#FBBF24', 0.18),
            'stat_color': AMBER,
            'icon_bg': tinted('#FBBF24', 0.08),
        },
        {
            'stat': '0%',
            'meta': 'immutable audit trail in legacy tools',
            'title': 'Zero accountability',
            'body': ('When disputes arise there is no record of approvals, conditions, '
                     'or capital flows. Litigation outcomes are uncertain.'),
            'border': tinted('#F87171', 0.18),
            'stat_color': RED,
            'icon_bg': tinted('#F87171', 0.08),
        },
    ]

    card_w = 256; card_h = 210; gap = 18
    total = 3 * card_w + 2 * gap
    x0 = (PAGE_W - total) / 2
    y_top = 270
    for i, card in enumerate(cards):
        x = x0 + i * (card_w + gap)
        rect(c, x, y_top, card_w, card_h, fill=w(0.022), stroke=card['border'], radius=14)
        # icon tile
        rect(c, x + 24, y_top + 22, 28, 28, fill=card['icon_bg'], radius=8)
        # stat
        text_at(c, x + 24, y_top + 68, card['stat'], F_BOLD, 32, card['stat_color'])
        text_at(c, x + 24, y_top + 108, card['meta'], F_REG, 9, w(0.4))
        # title
        text_at(c, x + 24, y_top + 130, card['title'], F_BOLD, 13, w(0.96))
        # body
        for j, ln in enumerate(wrap(card['body'], F_REG, 10, card_w - 48)):
            text_at(c, x + 24, y_top + 152 + j * 14, ln, F_REG, 10, w(0.55))


# ─────────────────────────────────────────────────────────────────────────────
# SLIDE 3 — SOLUTION
# ─────────────────────────────────────────────────────────────────────────────

def draw_slide_solution(c):
    draw_background(c)
    draw_chrome(c, 3, 7, 'Solution')

    # Ambient glow bottom-centre
    c.setFillColor(tinted('#1A3A96', 0.10))
    c.ellipse(PAGE_W/2 - 300, -200, PAGE_W/2 + 300, 180, stroke=0, fill=1)

    left = 72
    draw_eyebrow(c, left, 72, 'THE SOLUTION')

    text_at(c, left, 102, 'Programmable escrow,', F_BOLD, 36, w(0.96))
    text_at(c, left, 140, 'not another dashboard.', F_BOLD, 36, BLUE_300)

    for i, ln in enumerate(wrap(
        'Vektrum places a programmable release gate between funder capital and '
        'contractor payouts. Every condition is enforced server-side — not in the UI, '
        'not in a PDF, not in someone\'s inbox.',
        F_REG, 11.5, 430)):
        text_at(c, left, 200 + i * 17, ln, F_REG, 11.5, w(0.55))

    # Checklist (left col)
    bullets = [
        'Conditions enforced in the database layer — cannot be bypassed',
        'AI draw review with multi-provider fallback chain',
        'Hash-chained append-only audit log with tamper detection',
        'Native Stripe Connect payouts — no ACH delays',
        'DocuSign contract required before first milestone release',
        'Admin override requires AAL2 MFA + justification + audit trail',
    ]
    by = 288
    for i, b in enumerate(bullets):
        y = by + i * 22
        # bullet dot
        rect(c, left + 4, y + 4, 9, 9, fill=tinted('#1A3A96', 0.25), radius=4.5)
        # tick inside
        c.setStrokeColor(BLUE_400); c.setLineWidth(1); c.setLineCap(1); c.setLineJoin(1)
        p = c.beginPath()
        p.moveTo(left + 6.2, PAGE_H - (y + 8.5))
        p.lineTo(left + 7.8, PAGE_H - (y + 10))
        p.lineTo(left + 10.8, PAGE_H - (y + 7))
        c.drawPath(p, stroke=1, fill=0)
        # text
        text_at(c, left + 22, y, b, F_REG, 10.5, w(0.68))

    # Flow diagram (right col)
    flow_x = PAGE_W - 340
    flow_y = 96
    flow_w = 286
    steps = [
        {'name': 'Funder',           'sub': 'Capital deposited into deal escrow',
         'border': tinted('#3B82F6', 0.25), 'bg': tinted('#3B82F6', 0.06), 'icon_color': BLUE_400, 'core': False},
        {'name': 'AI Precondition',  'sub': 'Multi-provider draw review',
         'border': tinted('#C084FC', 0.30), 'bg': tinted('#C084FC', 0.07), 'icon_color': PURPLE, 'core': False},
        {'name': 'Release Gate',     'sub': '10 conditions, atomically enforced',
         'border': tinted('#1A3A96', 0.55), 'bg': tinted('#1A3A96', 0.18), 'icon_color': BLUE_300, 'core': True},
        {'name': 'Contractor',       'sub': 'Stripe payout on gate pass',
         'border': tinted('#34D399', 0.30), 'bg': tinted('#34D399', 0.08), 'icon_color': EMERALD, 'core': False},
    ]
    sh = 54; sgap = 8
    for i, step in enumerate(steps):
        y = flow_y + i * (sh + sgap)
        rect(c, flow_x, y, flow_w, sh,
             fill=step['bg'], stroke=step['border'], radius=11, line_width=1.0)
        # icon tile
        rect(c, flow_x + 14, y + 13, 28, 28,
             fill=w(0.06), radius=7)
        # icon dot (placeholder — colored square inside)
        rect(c, flow_x + 22, y + 21, 12, 12, fill=step['icon_color'], radius=3)
        # name
        text_at(c, flow_x + 54, y + 13, step['name'], F_BOLD, 12, w(0.97))
        # sub
        text_at(c, flow_x + 54, y + 32, step['sub'], F_REG, 9, w(0.45))
        # core pill
        if step['core']:
            pw = 34
            rect(c, flow_x + flow_w - pw - 14, y + 19, pw, 16,
                 fill=tinted('#1A3A96', 0.15), stroke=tinted('#1A3A96', 0.4), radius=8, line_width=0.7)
            text_center(c, flow_x + flow_w - pw/2 - 14, y + 23,
                        'CORE', F_BOLD, 7, BLUE_300)
        # connector line
        if i < len(steps) - 1:
            line(c, flow_x + flow_w/2, y + sh,
                 flow_x + flow_w/2, y + sh + sgap,
                 stroke=w(0.12), line_width=1)


# ─────────────────────────────────────────────────────────────────────────────
# SLIDE 4 — RELEASE GATE
# ─────────────────────────────────────────────────────────────────────────────

def draw_slide_gate(c):
    draw_background(c)
    draw_chrome(c, 4, 7, 'Release Gate')

    # Ambient glow middle-right
    c.setFillColor(tinted('#1A3A96', 0.09))
    c.ellipse(PAGE_W - 80, PAGE_H/2 - 220, PAGE_W + 320, PAGE_H/2 + 220, stroke=0, fill=1)

    left = 72
    draw_eyebrow(c, left, 72, 'THE RELEASE GATE')

    text_at(c, left, 102, '10 conditions.',  F_BOLD, 34, w(0.96))
    text_at(c, left, 138, 'Zero exceptions.', F_BOLD, 34, w(0.4))

    for i, ln in enumerate(wrap(
        'Every fund release passes all 10 checks atomically in a single '
        'server-side transaction. There is no UI path around this gate — it '
        'lives in the database layer, not the application layer.',
        F_REG, 10.5, 270)):
        text_at(c, left, 200 + i * 15, ln, F_REG, 10.5, w(0.55))

    # AI precondition callout
    ai_top = 286
    ai_h = 82
    rect(c, left, ai_top, 290, ai_h,
         fill=tinted('#C084FC', 0.07), stroke=tinted('#C084FC', 0.22), radius=10)
    text_at(c, left + 16, ai_top + 12, 'AI PRECONDITION', F_BOLD, 8, PURPLE)
    for i, ln in enumerate(wrap(
        'Runs BEFORE the gate. Multi-provider chain: Perplexity → Anthropic → OpenAI. '
        'Malformed responses default to risk_level: critical.',
        F_REG, 9, 258)):
        text_at(c, left + 16, ai_top + 30 + i * 12, ln, F_REG, 9, w(0.55))

    # Integrity note
    int_top = 378
    rect(c, left, int_top, 290, 52,
         fill=w(0.025), stroke=w(0.07), radius=10)
    for i, ln in enumerate(wrap(
        'All releases produce an append-only, hash-chained audit log entry. '
        'Modification triggers SQLSTATE 23001 at the DB level.',
        F_REG, 9, 258)):
        text_at(c, left + 16, int_top + 12 + i * 12, ln, F_REG, 9, w(0.48))

    # Conditions grid (2×5 — right side)
    conditions = [
        ('01', 'Milestone approved',       'Funder has explicitly approved the milestone'),
        ('02', 'Protection ready',          'protection_status = ready_for_release'),
        ('03', 'Sufficient balance',        'Escrow holds enough capital to cover release'),
        ('04', 'Stripe payouts enabled',    'Contractor can receive Connect transfers'),
        ('05', 'Onboarding complete',       'Contractor KYC / AML checks have passed'),
        ('06', 'No existing release',       'Idempotency guard — prevents double-release'),
        ('07', 'No open change orders',     'All change orders resolved before release'),
        ('08', 'Signed contract',           'DocuSign envelope fully executed'),
        ('09', 'Sequential ordering',       'Prior milestones cleared — prereqs enforced'),
        ('10', 'Approved lien waiver',      'Conditional lien waiver on file'),
    ]
    grid_x = 400
    grid_y = 102
    cell_w = 232
    cell_h = 62
    col_gap = 10
    row_gap = 8
    for i, (num, label, desc) in enumerate(conditions):
        col = i % 2
        row = i // 2
        x = grid_x + col * (cell_w + col_gap)
        y = grid_y + row * (cell_h + row_gap)
        rect(c, x, y, cell_w, cell_h, fill=w(0.02), stroke=w(0.065), radius=10)
        # number
        text_at(c, x + 14, y + 12, num, F_MONO, 8.5, tinted('#60A5FA', 0.7))
        # label
        text_at(c, x + 34, y + 10, label, F_BOLD, 11, w(0.96))
        # desc
        for j, ln in enumerate(wrap(desc, F_REG, 8.5, cell_w - 68)):
            text_at(c, x + 34, y + 28 + j * 11, ln, F_REG, 8.5, w(0.42))
        # tick
        mark_tick(c, x + cell_w - 16, y + 16)


# ─────────────────────────────────────────────────────────────────────────────
# SLIDE 5 — COMPETITIVE
# ─────────────────────────────────────────────────────────────────────────────

def draw_slide_competitive(c):
    draw_background(c)
    draw_chrome(c, 5, 7, 'Competitive')

    left = 72
    draw_eyebrow(c, left, 72, 'COMPETITIVE LANDSCAPE')

    text_at(c, left, 100, 'The infrastructure gap',   F_BOLD, 34, w(0.96))
    text_at(c, left, 136, 'no one else has closed.',  F_BOLD, 34, w(0.4))

    # Right side caption
    caption_x = PAGE_W - 340
    for i, ln in enumerate(wrap(
        'Competitors offer dashboards and workflows. Vektrum is the only '
        'platform with server-side enforcement — the difference between '
        'a guardrail and a gate.',
        F_REG, 9.5, 268)):
        text_at(c, caption_x, 110 + i * 13, ln, F_REG, 9.5, w(0.4))

    # Table geometry
    rows = [
        ('Automated release gate',     'C','X','X','X','X'),
        ('Server-side enforcement',    'C','X','X','X','X'),
        ('AI-assisted draw review',    'C','X','X','X','X'),
        ('Native Stripe payouts',      'C','H','X','X','X'),
        ('Hash-chained audit log',     'C','X','H','X','X'),
        ('Dispute resolution engine',  'C','H','H','X','X'),
        ('DocuSign gate enforcement',  'C','X','H','X','X'),
        ('Real-time ops monitoring',   'C','H','X','X','X'),
    ]
    cols = [('Vektrum', True), ('Built Tech', False), ('Procore', False),
            ('Banks', False), ('Manual', False)]

    t_x = left
    t_y = 210
    feat_w = 332
    col_w = 96
    header_h = 32
    row_h = 28
    t_w = feat_w + len(cols) * col_w
    t_h = header_h + len(rows) * row_h

    # Outer border
    rect(c, t_x, t_y, t_w, t_h, fill=w(0.012), stroke=w(0.08), radius=12)

    # Header row highlight for Vektrum column
    vektrum_col_x = t_x + feat_w
    rect(c, vektrum_col_x, t_y, col_w, t_h, fill=tinted('#1A3A96', 0.06), radius=0)

    # Header text
    text_at(c, t_x + 18, t_y + 12, 'CAPABILITY', F_BOLD, 8, w(0.3))
    for i, (label, highlight) in enumerate(cols):
        cx = t_x + feat_w + i * col_w + col_w / 2
        text_center(c, cx, t_y + 12, label.upper(), F_BOLD, 8,
                    BLUE_400 if highlight else w(0.38))

    # Header bottom divider
    line(c, t_x, t_y + header_h, t_x + t_w, t_y + header_h,
         stroke=w(0.06), line_width=0.6)
    # Column dividers (vertical lines between columns)
    for i in range(len(cols)):
        vx = t_x + feat_w + i * col_w
        line(c, vx, t_y, vx, t_y + t_h, stroke=w(0.04), line_width=0.5)

    # Rows
    for r, row in enumerate(rows):
        ry = t_y + header_h + r * row_h
        # alt-row tint
        if r % 2 == 1:
            rect(c, t_x + 1, ry, t_w - 2, row_h, fill=w(0.013))
        # row divider
        if r > 0:
            line(c, t_x, ry, t_x + t_w, ry, stroke=w(0.035), line_width=0.5)
        # vektrum highlight for this row in vektrum col
        rect(c, vektrum_col_x, ry, col_w, row_h, fill=tinted('#1A3A96', 0.05))

        # feature label
        text_at(c, t_x + 18, ry + 10, row[0], F_REG, 10.5, w(0.72))

        # marks
        for i, mark_type in enumerate(row[1:]):
            cx = t_x + feat_w + i * col_w + col_w / 2
            cy = ry + row_h / 2
            if mark_type == 'C':
                mark_tick(c, cx, cy)
            elif mark_type == 'X':
                mark_cross(c, cx, cy)
            else:
                mark_half(c, cx, cy)

    # Legend
    lg_y = t_y + t_h + 14
    legend = [
        ('tick',  'Full support'),
        ('half',  'Partial / limited'),
        ('cross', 'Not supported'),
    ]
    lgx = t_x
    for kind, label in legend:
        if   kind == 'tick':  mark_tick(c, lgx + 8, lg_y + 8)
        elif kind == 'half':  mark_half(c, lgx + 8, lg_y + 8)
        else:                 mark_cross(c, lgx + 8, lg_y + 8)
        text_at(c, lgx + 22, lg_y + 4, label, F_REG, 9, w(0.34))
        lgx += stringWidth(label, F_REG, 9) + 56


# ─────────────────────────────────────────────────────────────────────────────
# SLIDE 6 — MARKET
# ─────────────────────────────────────────────────────────────────────────────

def draw_slide_market(c):
    draw_background(c)
    draw_chrome(c, 6, 7, 'Market')

    # Ambient glow top-centre
    c.setFillColor(tinted('#1A3A96', 0.09))
    c.ellipse(PAGE_W/2 - 280, PAGE_H - 60, PAGE_W/2 + 280, PAGE_H + 180, stroke=0, fill=1)

    left = 72
    draw_eyebrow(c, left, 72, 'MARKET OPPORTUNITY')

    text_at(c, left, 102, '$1.8T market.',        F_BOLD, 36, w(0.96))
    text_at(c, left, 140, 'Zero infrastructure.', F_BOLD, 36, w(0.4))

    for i, ln in enumerate(wrap(
        'Construction lending is one of the largest and least-digitised credit '
        'markets in the US. The enforcement layer has seen zero investment — until now.',
        F_REG, 11, 420)):
        text_at(c, left, 200 + i * 16, ln, F_REG, 11, w(0.5))

    # TAM / SAM / SOM bars — full bar stays in the left column, desc floats below value
    tiers = [
        ('TAM', '$1.8T', 380, tinted('#1A3A96', 0.20), tinted('#1A3A96', 0.50), BLUE_300,
         'Annual US construction starts — all draw-financed'),
        ('SAM', '$420B', 284, tinted('#60A5FA', 0.13), tinted('#60A5FA', 0.32), BLUE_400,
         'Draw management in CRE + residential with digital tooling'),
        ('SOM', '$2.4B', 152, tinted('#34D399', 0.13), tinted('#34D399', 0.32), EMERALD,
         '3-year target — mid-market lenders + high-vol contractors'),
    ]
    bar_y = 280
    bar_h = 48
    bar_gap = 14
    label_w = 34
    desc_x = left + label_w + 8 + 380 + 14   # anchored to TAM bar right-edge
    for i, (tier_name, value, bar_w, fill, border, val_color, desc) in enumerate(tiers):
        y = bar_y + i * (bar_h + bar_gap)
        # label
        text_at(c, left, y + 16, tier_name, F_BOLD, 10, w(0.5))
        # bar
        bx = left + label_w + 8
        rect(c, bx, y, bar_w, bar_h, fill=fill, stroke=border, radius=10)
        text_at(c, bx + 20, y + 14, value, F_BOLD, 18, val_color)
        # desc
        for j, ln in enumerate(wrap(desc, F_REG, 9, 190)):
            text_at(c, desc_x, y + 10 + j * 12, ln, F_REG, 9, w(0.45))

    # Right-side stat cards
    stats = [
        ('8.2%',   'CAGR',        'Construction lending growth through 2030'),
        ('$13B',   'Draw fraud',  'Estimated annual US loss in disbursement'),
        ('180K+',  'GCs',         'US general contractors in the SAM segment'),
        ('2,300+', 'Lenders',     'Community banks doing construction draws'),
    ]
    sx = PAGE_W - 280
    sy = 102
    sw = 232
    sh = 80
    for i, (val, label, sub) in enumerate(stats):
        y = sy + i * (sh + 8)
        rect(c, sx, y, sw, sh, fill=w(0.025), stroke=w(0.075), radius=11)
        text_at(c, sx + 18, y + 14, val, F_BOLD, 22, w(0.96))
        text_at(c, sx + 18 + stringWidth(val, F_BOLD, 22) + 6,
                y + 20, label.upper(), F_BOLD, 8, w(0.38))
        for j, ln in enumerate(wrap(sub, F_REG, 9, sw - 36)):
            text_at(c, sx + 18, y + 46 + j * 12, ln, F_REG, 9, w(0.4))


# ─────────────────────────────────────────────────────────────────────────────
# SLIDE 7 — BUSINESS MODEL
# ─────────────────────────────────────────────────────────────────────────────

def draw_slide_model(c):
    draw_background(c)
    draw_chrome(c, 7, 7, 'Business Model')

    # Ambient glow bottom-right
    c.setFillColor(tinted('#1A3A96', 0.08))
    c.ellipse(PAGE_W - 80, -160, PAGE_W + 240, 240, stroke=0, fill=1)

    left = 72
    draw_eyebrow(c, left, 72, 'BUSINESS MODEL')

    text_at(c, left, 102, 'Take rate on',          F_BOLD, 36, w(0.96))
    text_at(c, left, 140, 'capital at rest.',      F_BOLD, 36, EMERALD_3)

    for i, ln in enumerate(wrap(
        'Revenue compounds with deal volume. As lenders run more draws through '
        'the gate, platform revenue scales with capital flow — not headcount.',
        F_REG, 11, 420)):
        text_at(c, left, 200 + i * 16, ln, F_REG, 11, w(0.5))

    # Revenue streams
    streams = [
        ('Transaction fee', '15–25 bps per released draw',
         '$850K draw → $1,275–$2,125 per release event',
         'PRIMARY',   tinted('#1A3A96', 0.22), tinted('#1A3A96', 0.05),
         BLUE_300,    tinted('#1A3A96', 0.25)),
        ('Platform fee',    '$500–$2,000 / month per lender',
         'Seat-based ops dashboard + admin tooling + API access',
         'RECURRING', tinted('#60A5FA', 0.15), tinted('#60A5FA', 0.03),
         BLUE_300,    tinted('#60A5FA', 0.22)),
        ('Enterprise API',  'Custom contract, usage-based',
         'White-label release gate for lender origination systems',
         'EXPANSION', tinted('#C084FC', 0.15), tinted('#C084FC', 0.04),
         PURPLE,      tinted('#C084FC', 0.22)),
    ]
    st_x = left
    st_y = 268
    st_w = 440
    st_h = 64
    for i, (name, model, example, badge, border, fill, badge_color, badge_border) in enumerate(streams):
        y = st_y + i * (st_h + 8)
        rect(c, st_x, y, st_w, st_h, fill=fill, stroke=border, radius=11)
        # name
        text_at(c, st_x + 18, y + 12, name, F_BOLD, 12, w(0.96))
        # badge
        bw = stringWidth(badge, F_BOLD, 7) + 14
        rect(c, st_x + st_w - bw - 16, y + 12, bw, 14,
             fill=tinted('#ffffff', 0.02), stroke=badge_border, radius=7, line_width=0.7)
        text_center(c, st_x + st_w - bw/2 - 16, y + 16, badge, F_BOLD, 7, badge_color)
        # model
        text_at(c, st_x + 18, y + 32, model, F_REG, 10, w(0.68))
        # example
        text_at(c, st_x + 18, y + 48, example, F_REG, 8.5, w(0.38))

    # Right column — unit economics
    ue_x = PAGE_W - 272
    ue_y = 102
    ue_w = 224
    rect(c, ue_x, ue_y, ue_w, 250, fill=w(0.022), stroke=w(0.075), radius=12)
    text_at(c, ue_x + 18, ue_y + 12, 'UNIT ECONOMICS', F_BOLD, 8, w(0.38))
    text_at(c, ue_x + 18, ue_y + 26, 'Per deal, annualised', F_REG, 8.5, w(0.3))
    line(c, ue_x, ue_y + 42, ue_x + ue_w, ue_y + 42, stroke=w(0.06), line_width=0.5)

    ue_rows = [
        ('Avg deal size',       '$850K',    False),
        ('Avg draws / deal',    '10',       False),
        ('Revenue / draw',      '~$170',    False),
        ('Revenue / deal / yr', '~$1,700',  True ),
        ('Gross margin',        '~88%',     True ),
        ('CAC (est.)',          '$2,800',   False),
        ('Payback period',      '~19 mo',   False),
    ]
    ry = ue_y + 54
    for i, (label, value, em) in enumerate(ue_rows):
        y = ry + i * 27
        if i > 0:
            line(c, ue_x + 10, y - 5, ue_x + ue_w - 10, y - 5,
                 stroke=w(0.035), line_width=0.4)
        text_at(c, ue_x + 18, y, label, F_REG, 9.5, w(0.5))
        text_right(c, ue_x + ue_w - 18, y, value, F_BOLD, 10,
                   EMERALD if em else w(0.8))

    # ARR milestones
    arr_y = 366
    rect(c, ue_x, arr_y, ue_w, 96, fill=tinted('#34D399', 0.045), stroke=tinted('#34D399', 0.2), radius=11)
    text_at(c, ue_x + 18, arr_y + 12, 'ARR MILESTONES', F_BOLD, 8, tinted('#34D399', 0.75))
    milestones = [('Y1', '$1.2M', '~700 deals'),
                  ('Y2', '$4.8M', '~2,800 deals'),
                  ('Y3', '$14M',  '~8,200 deals')]
    for i, (yr, val, dc) in enumerate(milestones):
        y = arr_y + 28 + i * 18
        text_at(c, ue_x + 18, y, yr, F_MONO, 8.5, w(0.3))
        text_at(c, ue_x + 42, y - 1, val, F_BOLD, 12, EMERALD)
        text_at(c, ue_x + 108, y, dc, F_REG, 8.5, w(0.38))


# ─────────────────────────────────────────────────────────────────────────────
# Build
# ─────────────────────────────────────────────────────────────────────────────

def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(repo_root, 'public')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'vektrum-pitch.pdf')

    c = canvas.Canvas(out_path, pagesize=(PAGE_W, PAGE_H))
    c.setTitle('Vektrum — Series A Pitch Deck')
    c.setAuthor('Vektrum')
    c.setSubject('The Release Gate for Construction Capital')

    slides = [
        draw_slide_hero,
        draw_slide_problem,
        draw_slide_solution,
        draw_slide_gate,
        draw_slide_competitive,
        draw_slide_market,
        draw_slide_model,
    ]
    for draw in slides:
        draw(c)
        c.showPage()

    c.save()
    size_kb = os.path.getsize(out_path) / 1024
    print(f'wrote {out_path}  ({size_kb:.1f} KB, {len(slides)} slides)')


if __name__ == '__main__':
    main()
