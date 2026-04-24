#!/usr/bin/env python3
"""
Generate: public/vektrum-operating-manual-v3.pdf
Vektrum Operating Manual v3 — dark-themed technical reference document.
Run: python3 scripts/generate_manual_pdf.py
"""

import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import Color, HexColor

# ── Page geometry ──────────────────────────────────────────────────────────────
PAGE_W, PAGE_H = letter          # 612 × 792 pt
ML = 50                          # left margin
MR = 50                          # right margin
MT = 56                          # top margin (below header line)
MB = 60                          # bottom margin (above footer)
CW = PAGE_W - ML - MR            # content width = 512 pt
FOOTER_Y = 32

# ── Colours ───────────────────────────────────────────────────────────────────
BG          = HexColor('#07091A')
SURFACE1    = HexColor('#0E1028')
SURFACE2    = HexColor('#141633')
BORDER      = Color(1, 1, 1, 0.08)
BLUE        = HexColor('#3B82F6')   # blue-500 — readable on dark
BLUE_DIM    = HexColor('#1E3A6E')
BLUE_DARK   = HexColor('#1A3A96')
WHITE       = Color(1, 1, 1, 1.0)
WHITE80     = Color(1, 1, 1, 0.80)
WHITE60     = Color(1, 1, 1, 0.60)
WHITE40     = Color(1, 1, 1, 0.40)
WHITE10     = Color(1, 1, 1, 0.10)
WHITE06     = Color(1, 1, 1, 0.06)
RED         = HexColor('#EF4444')
AMBER       = HexColor('#F59E0B')
EMERALD     = HexColor('#10B981')
CODE_BG     = HexColor('#0A0C22')
TABLE_HDR   = HexColor('#1E2848')
TABLE_ALT   = Color(1, 1, 1, 0.03)
TAG_BG      = Color(0.22, 0.48, 0.95, 0.15)

# ── Helpers ───────────────────────────────────────────────────────────────────

def y_from_top(c_canvas, top_offset):
    return PAGE_H - top_offset

def fill_bg(c):
    c.setFillColor(BG)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

def draw_header_bar(c, title=''):
    """Top rule + wordmark + section label."""
    bar_y = PAGE_H - 36
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(ML, bar_y, PAGE_W - MR, bar_y)
    # Wordmark
    c.setFont('Helvetica-Bold', 9)
    c.setFillColor(BLUE)
    c.drawString(ML, bar_y + 6, 'VEKTRUM')
    # Section label right-aligned
    if title:
        c.setFont('Helvetica', 8)
        c.setFillColor(WHITE40)
        c.drawRightString(PAGE_W - MR, bar_y + 6, title)

def draw_footer(c, page_num, total_pages):
    fy = FOOTER_Y
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(ML, fy + 10, PAGE_W - MR, fy + 10)
    c.setFont('Helvetica', 7.5)
    c.setFillColor(WHITE40)
    c.drawString(ML, fy, 'Operating Manual v3 · 2026-04-24 · Confidential')
    c.drawRightString(PAGE_W - MR, fy, f'Page {page_num}')

# ── Content state machine ─────────────────────────────────────────────────────

class Doc:
    def __init__(self, path):
        self.path = path
        self.c = canvas.Canvas(path, pagesize=letter)
        self.c.setTitle('Vektrum Operating Manual v3')
        self.c.setAuthor('Vektrum')
        self.page_num = 0
        self.section  = ''
        self.y = 0
        self._start_page()

    def _start_page(self):
        self.page_num += 1
        fill_bg(self.c)
        draw_header_bar(self.c, self.section)
        self.y = PAGE_H - MT - 4

    def new_page(self, section=None):
        draw_footer(self.c, self.page_num, '?')
        self.c.showPage()
        if section:
            self.section = section
        self._start_page()

    def need(self, h, section=None):
        """Ensure `h` pts of vertical space; break page if needed."""
        if self.y - h < MB + 20:
            self.new_page(section)

    def gap(self, pts=6):
        self.y -= pts

    def h1(self, text, section=None):
        if section:
            self.section = section
        self.need(36)
        self.y -= 8
        # Blue accent bar
        self.c.setFillColor(BLUE)
        self.c.rect(ML, self.y - 1, 3, 16, fill=1, stroke=0)
        self.c.setFont('Helvetica-Bold', 14)
        self.c.setFillColor(WHITE)
        self.c.drawString(ML + 10, self.y + 2, text.upper())
        self.y -= 20
        # Rule
        self.c.setStrokeColor(BORDER)
        self.c.setLineWidth(0.5)
        self.c.line(ML, self.y, PAGE_W - MR, self.y)
        self.y -= 10

    def h2(self, text):
        self.need(28)
        self.y -= 6
        self.c.setFont('Helvetica-Bold', 11)
        self.c.setFillColor(BLUE)
        self.c.drawString(ML, self.y, text)
        self.y -= 14

    def h3(self, text):
        self.need(20)
        self.y -= 4
        self.c.setFont('Helvetica-Bold', 9.5)
        self.c.setFillColor(WHITE80)
        self.c.drawString(ML, self.y, text)
        self.y -= 13

    def body(self, text, indent=0, color=None, size=9.5):
        """Word-wrapped body text."""
        self.need(14)
        col = color or WHITE80
        self.c.setFont('Helvetica', size)
        self.c.setFillColor(col)
        x = ML + indent
        max_w = CW - indent
        self._wrap_text(text, x, max_w, size, col)

    def body_bold(self, text, indent=0):
        self.need(14)
        self.c.setFont('Helvetica-Bold', 9.5)
        self.c.setFillColor(WHITE)
        self._wrap_text(text, ML + indent, CW - indent, 9.5, WHITE)

    def _wrap_text(self, text, x, max_w, size, color):
        """Simple word-wrap; returns nothing (updates self.y)."""
        words = text.split(' ')
        line  = ''
        self.c.setFont('Helvetica', size)
        self.c.setFillColor(color)
        for w in words:
            test = (line + ' ' + w).strip()
            if self.c.stringWidth(test, 'Helvetica', size) <= max_w:
                line = test
            else:
                if line:
                    self.need(13)
                    self.c.drawString(x, self.y, line)
                    self.y -= 13
                line = w
        if line:
            self.need(13)
            self.c.drawString(x, self.y, line)
            self.y -= 13

    def bullet(self, text, indent=12, bullet_char='•'):
        self.need(14)
        self.c.setFont('Helvetica', 9)
        self.c.setFillColor(BLUE)
        self.c.drawString(ML + indent - 9, self.y, bullet_char)
        self.c.setFillColor(WHITE80)
        # wrap
        max_w = CW - indent - 4
        words = text.split(' ')
        line  = ''
        bx    = ML + indent
        for w in words:
            test = (line + ' ' + w).strip()
            if self.c.stringWidth(test, 'Helvetica', 9) <= max_w:
                line = test
            else:
                if line:
                    self.need(12)
                    self.c.drawString(bx, self.y, line)
                    self.y -= 12
                    self.c.setFont('Helvetica', 9)
                    self.c.setFillColor(WHITE80)
                line = w
        if line:
            self.need(12)
            self.c.drawString(bx, self.y, line)
            self.y -= 12

    def numbered(self, items):
        for i, text in enumerate(items, 1):
            self.need(14)
            self.c.setFont('Helvetica-Bold', 9)
            self.c.setFillColor(BLUE)
            self.c.drawString(ML + 2, self.y, f'{i}.')
            self.c.setFont('Helvetica', 9)
            self.c.setFillColor(WHITE80)
            max_w = CW - 18
            words = text.split(' ')
            line  = ''
            bx    = ML + 18
            for w in words:
                test = (line + ' ' + w).strip()
                if self.c.stringWidth(test, 'Helvetica', 9) <= max_w:
                    line = test
                else:
                    if line:
                        self.need(12)
                        self.c.drawString(bx, self.y, line)
                        self.y -= 12
                        self.c.setFont('Helvetica', 9)
                        self.c.setFillColor(WHITE80)
                    line = w
            if line:
                self.need(12)
                self.c.drawString(bx, self.y, line)
                self.y -= 12
            self.y -= 2

    def code(self, lines, label=None):
        """Monospaced code block."""
        line_h  = 11
        pad     = 9
        n_lines = len(lines)
        box_h   = n_lines * line_h + pad * 2 + (12 if label else 0)
        self.need(box_h + 8)
        self.y -= 4
        bx, by = ML, self.y - box_h
        # Background
        self.c.setFillColor(CODE_BG)
        self.c.roundRect(bx, by, CW, box_h, 4, fill=1, stroke=0)
        self.c.setStrokeColor(BORDER)
        self.c.setLineWidth(0.5)
        self.c.roundRect(bx, by, CW, box_h, 4, fill=0, stroke=1)
        ty = by + box_h - pad - (10 if label else 0)
        if label:
            self.c.setFont('Helvetica', 7)
            self.c.setFillColor(WHITE40)
            self.c.drawString(bx + pad, ty, label)
            ty -= 12
        self.c.setFont('Courier', 7.5)
        self.c.setFillColor(WHITE80)
        for line in lines:
            self.c.drawString(bx + pad, ty, line)
            ty -= line_h
        self.y = by - 6

    def table(self, headers, rows, col_widths=None, header_color=None):
        """Draw a table with headers and data rows."""
        n_cols  = len(headers)
        if col_widths is None:
            col_widths = [CW / n_cols] * n_cols
        row_h   = 16
        hdr_h   = 18
        total_h = hdr_h + row_h * len(rows)
        self.need(min(total_h + 8, 160))
        self.y -= 4

        tx = ML
        ty = self.y

        def draw_row_bg(row_y, height, color):
            self.c.setFillColor(color)
            self.c.rect(tx, row_y - height, CW, height, fill=1, stroke=0)

        # Header row
        hdr_bg = header_color or TABLE_HDR
        draw_row_bg(ty, hdr_h, hdr_bg)
        self.c.setFont('Helvetica-Bold', 8)
        self.c.setFillColor(BLUE)
        cx = tx + 6
        for i, h in enumerate(headers):
            self.c.drawString(cx, ty - 12, str(h).upper())
            cx += col_widths[i]
        ty -= hdr_h

        # Data rows
        for ri, row in enumerate(rows):
            # Check if we need a new page mid-table
            if ty - row_h < MB + 20:
                # Draw border so far
                self.c.setStrokeColor(BORDER)
                self.c.setLineWidth(0.5)
                self.c.rect(tx, ty, CW, self.y - ty, fill=0, stroke=1)
                self.y = ty
                self.new_page()
                ty = self.y
                self.y -= 4
                ty = self.y
                # Redraw header
                draw_row_bg(ty, hdr_h, hdr_bg)
                self.c.setFont('Helvetica-Bold', 8)
                self.c.setFillColor(BLUE)
                cx2 = tx + 6
                for i, h in enumerate(headers):
                    self.c.drawString(cx2, ty - 12, str(h).upper())
                    cx2 += col_widths[i]
                ty -= hdr_h

            if ri % 2 == 1:
                draw_row_bg(ty, row_h, TABLE_ALT)

            self.c.setFont('Helvetica', 8)
            self.c.setFillColor(WHITE80)
            cx = tx + 6
            for ci, cell in enumerate(row):
                cell_str = str(cell)
                max_cell_w = col_widths[ci] - 10
                # Truncate if too wide
                while self.c.stringWidth(cell_str, 'Helvetica', 8) > max_cell_w and len(cell_str) > 4:
                    cell_str = cell_str[:-2] + '…'
                self.c.drawString(cx, ty - 11, cell_str)
                cx += col_widths[ci]
            ty -= row_h

        # Outer border
        drawn_h = self.y - ty
        self.c.setStrokeColor(BORDER)
        self.c.setLineWidth(0.5)
        self.c.rect(tx, ty, CW, drawn_h, fill=0, stroke=1)

        self.y = ty - 6

    def phase_card(self, number, title, bullets):
        """Numbered phase card (used for cron phases)."""
        pad   = 10
        line_h = 11
        n     = len(bullets)
        box_h = 14 + n * line_h + pad * 2
        self.need(box_h + 8)
        self.y -= 4
        by = self.y - box_h

        # Card bg
        self.c.setFillColor(SURFACE1)
        self.c.roundRect(ML, by, CW, box_h, 5, fill=1, stroke=0)
        self.c.setStrokeColor(BORDER)
        self.c.setLineWidth(0.5)
        self.c.roundRect(ML, by, CW, box_h, 5, fill=0, stroke=1)

        # Number badge
        badge_r = 9
        bx = ML + pad + badge_r
        badge_y = by + box_h - pad - badge_r - 2
        self.c.setFillColor(BLUE_DARK)
        self.c.circle(bx, badge_y, badge_r, fill=1, stroke=0)
        self.c.setFont('Helvetica-Bold', 8)
        self.c.setFillColor(WHITE)
        self.c.drawCentredString(bx, badge_y - 3, str(number))

        # Title
        self.c.setFont('Helvetica-Bold', 9.5)
        self.c.setFillColor(WHITE)
        self.c.drawString(bx + badge_r + 7, badge_y - 3, title)

        # Bullets
        ty = badge_y - badge_r - 6
        for b in bullets:
            self.c.setFont('Helvetica', 8)
            self.c.setFillColor(BLUE)
            self.c.drawString(ML + pad + 4, ty, '›')
            self.c.setFillColor(WHITE80)
            self.c.drawString(ML + pad + 14, ty, b[:90])
            ty -= line_h

        self.y = by - 6

    def severity_pill(self, label, color, x, y):
        w = self.c.stringWidth(label, 'Helvetica-Bold', 7) + 10
        self.c.setFillColor(Color(color.red, color.green, color.blue, 0.15))
        self.c.roundRect(x, y - 2, w, 11, 3, fill=1, stroke=0)
        self.c.setFillColor(color)
        self.c.setFont('Helvetica-Bold', 7)
        self.c.drawString(x + 5, y + 1, label)
        return w + 4

    def tag(self, text, x, y):
        w = self.c.stringWidth(text, 'Courier', 7.5) + 8
        self.c.setFillColor(TAG_BG)
        self.c.roundRect(x, y - 2, w, 11, 2, fill=1, stroke=0)
        self.c.setFont('Courier', 7.5)
        self.c.setFillColor(BLUE)
        self.c.drawString(x + 4, y + 1, text)
        return w + 3

    def note(self, text):
        """Callout note box."""
        pad = 8
        self.c.setFont('Helvetica', 8.5)
        # Estimate wrapped lines
        words = text.split()
        line, lines = '', []
        for w in words:
            t = (line + ' ' + w).strip()
            if self.c.stringWidth(t, 'Helvetica', 8.5) <= CW - 28:
                line = t
            else:
                lines.append(line); line = w
        if line: lines.append(line)
        box_h = len(lines) * 12 + pad * 2
        self.need(box_h + 8)
        self.y -= 4
        by = self.y - box_h
        self.c.setFillColor(Color(0.24, 0.51, 0.97, 0.08))
        self.c.roundRect(ML, by, CW, box_h, 4, fill=1, stroke=0)
        self.c.setStrokeColor(Color(0.36, 0.60, 0.98, 0.3))
        self.c.setLineWidth(0.5)
        self.c.roundRect(ML, by, CW, box_h, 4, fill=0, stroke=1)
        # Left accent
        self.c.setFillColor(BLUE)
        self.c.rect(ML, by, 3, box_h, fill=1, stroke=0)
        ty = by + box_h - pad - 9
        self.c.setFont('Helvetica', 8.5)
        self.c.setFillColor(WHITE80)
        for l in lines:
            self.c.drawString(ML + 12, ty, l)
            ty -= 12
        self.y = by - 6

    def save(self):
        draw_footer(self.c, self.page_num, self.page_num)
        self.c.save()
        print(f'Saved: {self.path}')


# ── Cover page ─────────────────────────────────────────────────────────────────

def draw_cover(c):
    fill_bg(c)

    # Top gradient glow
    for i in range(30):
        alpha = 0.06 * (1 - i / 30)
        c.setFillColor(Color(0.24, 0.51, 0.97, alpha))
        c.ellipse(PAGE_W / 2 - 180 + i * 4, PAGE_H - 60 - i * 5,
                  PAGE_W / 2 + 180 - i * 4, PAGE_H + 20, fill=1, stroke=0)

    # Wordmark
    c.setFont('Helvetica-Bold', 11)
    c.setFillColor(BLUE)
    c.drawString(ML, PAGE_H - 40, 'VEKTRUM')

    # Main title
    c.setFont('Helvetica-Bold', 38)
    c.setFillColor(WHITE)
    c.drawString(ML, PAGE_H - 190, 'Operating')
    c.drawString(ML, PAGE_H - 232, 'Manual')

    # Version badge
    c.setFillColor(BLUE_DARK)
    c.roundRect(ML, PAGE_H - 272, 68, 24, 5, fill=1, stroke=0)
    c.setFont('Helvetica-Bold', 11)
    c.setFillColor(WHITE)
    c.drawCentredString(ML + 34, PAGE_H - 264, 'v3')

    # Subtitle
    c.setFont('Helvetica', 13)
    c.setFillColor(WHITE60)
    c.drawString(ML, PAGE_H - 304, 'Construction Payment Governance Platform')

    # Date + status
    c.setFont('Helvetica', 9)
    c.setFillColor(WHITE40)
    c.drawString(ML, PAGE_H - 326, 'Updated 2026-04-24 · Confidential')

    # Horizontal rule
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(ML, PAGE_H - 346, PAGE_W - MR, PAGE_H - 346)

    # Core guarantees preview
    guarantees = [
        '10-condition server-side release gate — no UI bypass',
        'AI draw review precondition with multi-provider fallback chain',
        'Hash-chained, append-only audit log with DB-level tamper protection',
        'Deal freeze on contract void with admin-only unfreeze (AAL2)',
        'Hourly reconciliation with Stripe — Slack + email alerting',
        'SLA escalation for unresolved critical issues (> 1 hour)',
    ]
    c.setFont('Helvetica-Bold', 9)
    c.setFillColor(WHITE60)
    c.drawString(ML, PAGE_H - 366, 'CORE GUARANTEES')
    gy = PAGE_H - 384
    for g in guarantees:
        c.setFillColor(BLUE)
        c.setFont('Helvetica-Bold', 9)
        c.drawString(ML + 2, gy, '✓')
        c.setFont('Helvetica', 9)
        c.setFillColor(WHITE80)
        c.drawString(ML + 16, gy, g)
        gy -= 18

    # Bottom accent bar
    c.setFillColor(BLUE_DARK)
    c.rect(0, 0, PAGE_W, 4, fill=1, stroke=0)

    # Page num
    c.setFont('Helvetica', 7.5)
    c.setFillColor(WHITE40)
    c.drawRightString(PAGE_W - MR, FOOTER_Y, 'Page 1')


# ── Table of contents ──────────────────────────────────────────────────────────

TOC = [
    ('What is Vektrum?',                    2),
    ('Tech Stack',                          2),
    ('Setup Instructions',                  3),
    ('System Architecture',                 4),
    ('  Role separation',                   4),
    ('  Deal state machine',                4),
    ('  The 10-condition release gate',     5),
    ('  AI precondition & provider chain',  5),
    ('  Contract enforcement (DocuSign)',   6),
    ('  Deal freeze on void',               6),
    ('  Audit log',                         7),
    ('  Ops Dashboard',                     7),
    ('Security model',                      8),
    ('Reconciliation engine',               9),
    ('  Detection passes',                  9),
    ('  Lookback window',                   9),
    ('  Issue severities & auto-fix',      10),
    ('Operational alerting',               10),
    ('  Slack alerting',                   10),
    ('  Admin email alerting',             11),
    ('Cron job — hourly reconciliation',   11),
    ('  Phase 1 — Stuck-run detection',    11),
    ('  Phase 2 — Reconciliation passes',  12),
    ('  Phase 3 — New-findings alerting',  12),
    ('  Phase 4 — SLA escalation',         12),
    ('Key API routes',                     13),
    ('Environment variables',              13),
    ('Database migrations',                14),
    ('Deployment',                         14),
    ('Changelog',                          15),
]


def draw_toc(c, page_num):
    fill_bg(c)
    draw_header_bar(c, 'Contents')
    draw_footer(c, page_num, '?')

    c.setFont('Helvetica-Bold', 14)
    c.setFillColor(WHITE)
    c.drawString(ML, PAGE_H - MT - 4, 'TABLE OF CONTENTS')

    # Rule
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(ML, PAGE_H - MT - 18, PAGE_W - MR, PAGE_H - MT - 18)

    ty = PAGE_H - MT - 36
    for entry, pg in TOC:
        is_sub = entry.startswith('  ')
        label  = entry.strip()
        indent = 20 if is_sub else 0
        size   = 8.5 if is_sub else 9.5
        bold   = not is_sub

        c.setFont('Helvetica-Bold' if bold else 'Helvetica', size)
        c.setFillColor(WHITE80 if bold else WHITE60)
        c.drawString(ML + indent, ty, label)

        # Dots
        lw = c.stringWidth(label, 'Helvetica-Bold' if bold else 'Helvetica', size)
        pw = c.stringWidth(str(pg), 'Helvetica', size)
        dx = ML + indent + lw + 4
        ex = PAGE_W - MR - pw - 4
        c.setFillColor(WHITE40)
        c.setFont('Helvetica', 7)
        dot_x = dx
        while dot_x < ex - 4:
            c.drawString(dot_x, ty, '.')
            dot_x += 4.5

        # Page number
        c.setFont('Helvetica' if is_sub else 'Helvetica-Bold', size)
        c.setFillColor(BLUE if bold else WHITE40)
        c.drawRightString(PAGE_W - MR, ty, str(pg))

        ty -= (13 if bold else 11)
        if ty < MB + 10:
            break


# ── Main generation ───────────────────────────────────────────────────────────

def build():
    out_path = os.path.join(
        os.path.dirname(__file__), '..', 'public', 'vektrum-operating-manual-v3.pdf'
    )
    out_path = os.path.normpath(out_path)

    # ── Cover ──
    cv = canvas.Canvas(out_path, pagesize=letter)
    cv.setTitle('Vektrum Operating Manual v3')
    cv.setAuthor('Vektrum')
    draw_cover(cv)
    cv.showPage()
    draw_toc(cv, 2)
    cv.showPage()

    d = Doc.__new__(Doc)
    d.path     = out_path
    d.c        = cv
    d.page_num = 2
    d.section  = ''
    d.y        = 0
    fill_bg(d.c)
    draw_header_bar(d.c, d.section)
    d.page_num += 1
    d.y = PAGE_H - MT - 4

    # ═══════════════════════════════════════════════════════════════════════════
    # WHAT IS VEKTRUM
    # ═══════════════════════════════════════════════════════════════════════════
    d.h1('What is Vektrum?', section='Overview')
    d.body(
        'The construction industry loses billions annually to payment disputes, draw fraud, and frozen funds. '
        'In a typical legacy scenario, a funder wires the full project amount to a contractor at deal start — '
        'when a dispute arises over one milestone, the entire capital freezes, halting work site-wide.'
    )
    d.gap(6)
    d.body(
        'Vektrum replaces bulk upfront transfers with milestone-conditional escrow: capital is held by Stripe '
        'at deal creation, and each tranche releases only after passing a 10-condition server-side release gate '
        'plus an AI precondition. Every action is written to a hash-chained, append-only audit log that '
        'cannot be modified or deleted.'
    )
    d.gap(10)
    d.h2('Core Guarantees')
    d.table(
        ['Guarantee', 'Mechanism'],
        [
            ['No release without all 10 conditions',   'runReleaseGate() — no UI bypass possible'],
            ['No release without AI draw review',       'checkAiPrecondition runs before the gate'],
            ['No double-release',                       'Condition 6 (idempotency guard)'],
            ['No release on a voided contract',         'Deal freeze on void + gate hard-blocks frozen deals'],
            ['No admin override without MFA',           'AAL2 check on every admin write endpoint'],
            ['No audit manipulation',                   'Hash-chained log + deny_audit_modification trigger'],
        ],
        col_widths=[240, 272],
    )

    # ═══════════════════════════════════════════════════════════════════════════
    # TECH STACK
    # ═══════════════════════════════════════════════════════════════════════════
    d.gap(8)
    d.h1('Tech Stack', section='Tech Stack')
    d.table(
        ['Layer', 'Technology'],
        [
            ['Framework',       'Next.js 15 (App Router, React Server Components)'],
            ['Database + Auth', 'Supabase (Postgres 15, Row-Level Security, SSR auth)'],
            ['Payments',        'Stripe Connect (direct contractor payouts)'],
            ['Contract signing','DocuSign (envelope lifecycle via webhook)'],
            ['Styling',         'Tailwind CSS (dark fintech design system)'],
            ['Language',        'TypeScript (strict mode throughout)'],
            ['AI',              'Perplexity sonar-pro → claude-sonnet → gpt-4o (fallback chain)'],
        ],
        col_widths=[130, 382],
    )

    # ═══════════════════════════════════════════════════════════════════════════
    # SETUP INSTRUCTIONS
    # ═══════════════════════════════════════════════════════════════════════════
    d.new_page('Setup')
    d.h1('Setup Instructions', section='Setup')

    d.h2('1. Clone and install')
    d.code(['git clone [your-repo-url]', 'cd vektrum', 'npm install'])

    d.h2('2. Supabase setup')
    d.numbered([
        'Create a project at supabase.com',
        'Run all migration files in order via SQL Editor or Supabase CLI (supabase/migrations/)',
        'Copy credentials from Settings > API: Project URL, Anon key, Service role key',
    ])

    d.h2('3. Stripe setup')
    d.numbered([
        'Create an account at stripe.com and enable Connect',
        'Copy secret key from Developers > API keys → STRIPE_SECRET_KEY',
        'Create a webhook endpoint at https://your-domain.com/api/webhooks/stripe',
        'Subscribe: account.updated, payment_intent.succeeded, transfer.created, transfer.failed, transfer.reversed',
        'Copy webhook signing secret → STRIPE_WEBHOOK_SECRET',
    ])

    d.h2('4. DocuSign setup')
    d.numbered([
        'Create a developer account at developers.docusign.com',
        'Create an app; note Integration Key and Account ID',
        'Generate RSA keypair; store private key as DOCUSIGN_PRIVATE_KEY',
        'Configure Connect webhook at https://your-domain.com/api/webhooks/docusign',
        'Subscribe: recipient-completed, envelope-completed, envelope-voided, envelope-declined',
    ])

    d.h2('5. AI providers')
    d.body('Draw review uses a three-provider fallback chain. Set all three for full redundancy:')
    d.gap(4)
    d.code([
        'PERPLEXITY_API_KEY=pplx-...',
        'ANTHROPIC_API_KEY=sk-ant-...',
        'OPENAI_API_KEY=sk-...',
    ])
    d.body('See docs/ai-downtime-plan.md for full failure-mode documentation.')

    d.h2('6. Environment variables')
    d.code([
        '# Supabase',
        'NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...',
        'SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...',
        '',
        '# Stripe',
        'STRIPE_SECRET_KEY=sk_test_...',
        'STRIPE_WEBHOOK_SECRET=whsec_...',
        '',
        '# DocuSign',
        'DOCUSIGN_ACCOUNT_ID=...',
        'DOCUSIGN_INTEGRATION_KEY=...',
        'DOCUSIGN_PRIVATE_KEY=...',
        '',
        '# AI providers',
        'PERPLEXITY_API_KEY=pplx-...',
        'ANTHROPIC_API_KEY=sk-ant-...',
        'OPENAI_API_KEY=sk-...',
        '',
        '# App',
        'NEXT_PUBLIC_APP_URL=http://localhost:3000',
        '',
        '# Cron auth',
        'CRON_SECRET=...',
        '',
        '# Ops alerting (new in v3)',
        'SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...',
        'EMAIL_FROM=Vektrum <noreply@vektrum.io>',
        'ADMIN_EMAIL=ops@vektrum.io,cto@vektrum.io',
        'RESEND_API_KEY=re_...',
        '',
        '# Reconciliation (new in v3)',
        'RECONCILIATION_LOOKBACK_HOURS=72     # default: 72',
        '',
        '# Optional',
        'AI_ADMIN_OVERRIDE_TTL_HOURS=4',
    ])

    d.h2('7. Run locally')
    d.code(['npm run dev'])
    d.body('Open http://localhost:3000')

    # ═══════════════════════════════════════════════════════════════════════════
    # SYSTEM ARCHITECTURE
    # ═══════════════════════════════════════════════════════════════════════════
    d.new_page('Architecture')
    d.h1('System Architecture', section='Architecture')

    d.h2('Role Separation')
    d.table(
        ['Role', 'Capabilities'],
        [
            ['Contractor', 'Create deals, add milestones, upload contract, submit draw requests'],
            ['Funder',     'Fund deals, approve/reject milestones, trigger releases'],
            ['Admin',      'Read all deals + audit logs; AI overrides (AAL2); unfreeze deals (AAL2); Ops Dashboard'],
        ],
        col_widths=[90, 422],
    )
    d.gap(4)
    d.note('Admins cannot release funds directly. Release is always triggered by the deal funder. Admin write actions require AAL2 MFA.')

    d.gap(8)
    d.h2('Deal State Machine')
    d.code([
        'draft',
        '  └─► active          (funder funds the deal)',
        '        ├─► in_progress   (milestone work begins)',
        '        ├─► completed     (all milestones released)',
        '        ├─► disputed      (milestone dispute raised)',
        '        │     └─► active  (dispute resolved)',
        '        ├─► frozen        (contract voided after ≥1 release)',
        '        │     └─► [prior] (admin unfreezes)',
        '        └─► cancelled',
    ], label='Deal states')

    d.gap(4)
    d.h2('Milestone State Machine')
    d.code([
        'not_started',
        '  └─► in_progress         (contractor starts work)',
        '        └─► ready_for_review  (contractor submits draw request)',
        '              ├─► approved        (funder approves)',
        '              │     └─► released  (funder releases payment)',
        '              ├─► in_progress     (funder requests changes)',
        '              └─► disputed',
    ], label='Milestone states')

    d.gap(8)
    d.h2('The 10-Condition Release Gate')
    d.body('src/lib/engine/release-gate.ts — runReleaseGate()', color=WHITE60)
    d.gap(4)
    d.body(
        'Before the gate runs, checkAiPrecondition() must pass. '
        'If the deal is frozen, the gate returns an error immediately without checking any conditions. '
        'All 10 conditions are evaluated atomically in a single server call.'
    )
    d.gap(6)
    d.table(
        ['#', 'Condition', 'What it checks'],
        [
            ['1',  'Milestone approved',          'milestone.status === approved'],
            ['2',  'Protection ready',             'milestone.protection_status === ready_for_release'],
            ['3',  'Sufficient funded balance',    'Escrow balance >= milestone amount'],
            ['4',  'Stripe payouts enabled',       'contractor.stripe_payouts_enabled === true'],
            ['5',  'Contractor onboarding',        'contractor.onboarding_complete === true'],
            ['6',  'No existing release',          'No non-voided release row for this milestone'],
            ['7',  'No open change orders',        'Zero unresolved change orders on deal'],
            ['8',  'Signed contract',              'A non-voided contract row exists for the deal'],
            ['9',  'Sequential ordering',          'All prior-ordered milestones are in released status'],
            ['10', 'Approved lien waiver',         'Conditional lien waiver on file for this milestone'],
        ],
        col_widths=[22, 150, 340],
    )

    d.gap(8)
    d.h2('AI Precondition & Multi-Provider Chain')
    d.body('src/lib/engine/release-gate.ts — checkAiPrecondition()', color=WHITE60)
    d.gap(4)
    d.body('An AI draw review must exist and be valid before the gate runs. A review is valid when:')
    d.bullet('risk_level !== critical')
    d.bullet('The review was written less than 48 hours ago')
    d.gap(6)
    d.table(
        ['Order', 'Provider', 'Model'],
        [
            ['1', 'Perplexity', 'sonar-pro'],
            ['2', 'Anthropic',  'claude-sonnet-4-20250514'],
            ['3', 'OpenAI',     'gpt-4o'],
        ],
        col_widths=[50, 150, 312],
    )
    d.gap(4)
    d.note(
        'Malformed AI response → synthetic assessment with risk_level: critical, score: 0, '
        'recommendation: hold. This BLOCKS the release rather than silently passing.'
    )

    # Contract enforcement
    d.gap(8)
    d.h2('Contract Enforcement (DocuSign)')
    d.body('src/app/api/webhooks/docusign/route.ts', color=WHITE60)
    d.gap(4)
    d.table(
        ['Webhook event', 'Action'],
        [
            ['recipient-completed',  'Early-return (individual signer step, not fully executed)'],
            ['envelope-completed',   'Mark contract status = signed; log contract_signed'],
            ['envelope-voided',      'Mark contract status = voided; run freezeDealIfReleasesExist()'],
            ['envelope-declined',    'Mark contract status = voided with decliner metadata; run freeze check'],
        ],
        col_widths=[160, 352],
    )

    d.gap(8)
    d.h2('Deal Freeze on Void')
    d.body('When freezeDealIfReleasesExist() fires on envelope-voided or envelope-declined:')
    d.gap(4)
    d.numbered([
        'Checks for any milestone with status = released on the deal.',
        'If found — captures deal.status as frozen_from_status, sets deal.status = frozen and deal_freeze_on_void = true.',
        'Writes an admin_audit_log entry: contract_voided_with_releases.',
    ])
    d.gap(4)
    d.body('Unfreeze endpoint: POST /api/admin/deals/:dealId/unfreeze')
    d.bullet('Requires: admin role + AAL2 MFA + justification (>= 20 chars)')
    d.bullet('Returns 409 if the deal is not frozen')
    d.bullet('Dual-writes admin_unfreeze_deal to the admin audit log')

    # Audit log
    d.gap(8)
    d.h2('Audit Log')
    d.body('audit_log table — append-only, hash-chained. Each entry contains: entity_type, entity_id, action, actor_id, created_at, metadata JSON, previous_hash, entry_hash.')
    d.gap(4)
    d.body('A deny_audit_modification DB trigger fires RAISE EXCEPTION SQLSTATE 23001 on any UPDATE or DELETE. There is no application-level path to modify audit entries.')

    d.gap(8)
    d.h2('Admin Audit Log')
    d.body('admin_audit_log table — separate from the operational log; covers privileged write actions only.')
    d.gap(4)
    d.table(
        ['Action', 'Trigger'],
        [
            ['ai_review_admin_override',      'Admin overrides AI precondition'],
            ['admin_unfreeze_deal',            'Admin unfreezes a frozen deal'],
            ['contract_voided_with_releases',  'DocuSign void fires with existing releases'],
            ['release_gate_override',          'Admin overrides a gate condition (future)'],
        ],
        col_widths=[230, 282],
    )
    d.gap(4)
    d.note('Entries without reviewed_by are flagged as unreviewed in the Ops Dashboard — four-eyes review required.')

    d.gap(8)
    d.h2('Ops Dashboard')
    d.body('/dashboard/admin/ops — admin-only, read-only monitoring.')
    d.gap(4)
    d.table(
        ['Panel', 'What it surfaces'],
        [
            ['Summary strip',    'Stuck approvals, failed payouts, webhook health, open disputes'],
            ['Search',           'Full-text across deals, users, and Stripe transfers'],
            ['Alert Feed',       'All active operational signals sorted by severity'],
            ['Release Health',   'Milestones stuck in approved > 4h; payout_failed milestones'],
            ['Webhook Health',   'Stale pending transfers; last Stripe webhook timestamp'],
            ['Admin Audit Log',  'Last 20 privileged write actions; unreviewed-count badge'],
        ],
        col_widths=[140, 372],
    )
    d.gap(4)
    d.note('API routes (/api/admin/ops/*) require admin role + AAL2 MFA. The page server-component forwards session cookies on its internal loopback fetches.')

    # ═══════════════════════════════════════════════════════════════════════════
    # SECURITY MODEL
    # ═══════════════════════════════════════════════════════════════════════════
    d.new_page('Security')
    d.h1('Security Model', section='Security')

    d.h2('Authentication Levels')
    d.table(
        ['Level', 'Description'],
        [
            ['AAL1 (Standard)', 'Email link or password sign-in. Required for all authenticated routes.'],
            ['AAL2 (MFA)',       'TOTP second factor. Required for ALL admin write actions. Non-MFA admin sessions rejected with 403.'],
        ],
        col_widths=[130, 382],
    )

    d.gap(8)
    d.h2('Row Level Security')
    d.body('All tables have RLS enabled. Key policies:')
    d.gap(4)
    d.bullet('Deals: visible only to their contractor_id and funder_id (plus admin via service role)')
    d.bullet('Milestones: visible to deal participants only')
    d.bullet('Audit log: readable by deal participants; writable only by service role')
    d.bullet('Admin audit log: readable and writable by service role only')

    d.gap(8)
    d.h2('Audit Log Tamper Protection')
    d.code([
        'CREATE OR REPLACE FUNCTION deny_audit_modification()',
        'RETURNS TRIGGER AS $$',
        'BEGIN',
        "  RAISE EXCEPTION SQLSTATE '23001'",
        "    USING MESSAGE = 'Audit log entries are immutable.';",
        'END;',
        '$$ LANGUAGE plpgsql;',
    ], label='DB trigger — fires on UPDATE and DELETE on audit_log and admin_audit_log')
    d.gap(4)
    d.note(
        'No application-level path, migration, or role can bypass this trigger without dropping it first — '
        'which would itself be visible in Supabase\'s database event log.'
    )

    # ═══════════════════════════════════════════════════════════════════════════
    # RECONCILIATION ENGINE  (new in v3)
    # ═══════════════════════════════════════════════════════════════════════════
    d.new_page('Reconciliation')
    d.h1('Reconciliation Engine  ·  NEW IN v3', section='Reconciliation')
    d.body('src/lib/engine/reconciliation.ts — runReconciliation(options)', color=WHITE60)
    d.gap(4)
    d.body(
        'Runs five detection passes that compare the Vektrum database against live Stripe data. '
        'Issues are deduplicated by a stable dedup_key so re-runs update existing open issues rather '
        'than inserting duplicates. Upserts preserve the original created_at, so only first-detection '
        'rows have created_at >= runStart.'
    )

    d.gap(8)
    d.h2('Detection Passes')
    d.table(
        ['Pass', 'Direction', 'Issue types detected'],
        [
            ['1', 'DB → Stripe',         'orphaned_transfer, amount_mismatch, metadata_mismatch'],
            ['2', 'Billing records',      'missing_billing_record'],
            ['3', 'Stripe → DB',          'stripe_transfer_not_found'],
            ['4', 'Ledger arithmetic',    'ledger_drift, fee_ledger_drift'],
            ['5', 'Funding confirmation', 'funding_phantom_balance, funding_missing_webhook'],
        ],
        col_widths=[36, 120, 356],
    )

    d.gap(8)
    d.h2('Lookback Window')
    d.body('Default: 72 hours. Priority order:')
    d.gap(4)
    d.numbered([
        'windowHours option passed to runReconciliation() directly',
        'RECONCILIATION_LOOKBACK_HOURS environment variable',
        'windowDays option (legacy; converted to hours) — fallback default is 7 days',
    ])
    d.gap(4)
    d.note(
        'Pass 5 applies the same window to PaymentIntent results. '
        'Stripe Search does not support date-range filters on metadata queries; '
        'results are filtered by pi.created after fetching.'
    )

    d.gap(8)
    d.h2('Issue Severities')
    d.table(
        ['Severity', 'Issue types', 'Auto-fixable'],
        [
            ['critical', 'orphaned_transfer, missing_stripe_id, amount_mismatch, ledger_drift, funding_phantom_balance', 'ledger_drift only'],
            ['high',     'stripe_transfer_not_found, missing_billing_record, fee_ledger_drift, funding_missing_webhook', 'missing_billing_record, fee_ledger_drift'],
            ['medium',   'metadata_mismatch',                                                                            'No'],
        ],
        col_widths=[60, 310, 142],
    )
    d.gap(4)
    d.note('Auto-fixable issues can be repaired from the Ops Dashboard (admin only). All other types require manual investigation.')

    # ═══════════════════════════════════════════════════════════════════════════
    # OPERATIONAL ALERTING  (new in v3)
    # ═══════════════════════════════════════════════════════════════════════════
    d.gap(8)
    d.h1('Operational Alerting  ·  NEW IN v3', section='Alerting')

    d.h2('Slack Alerting  (src/lib/engine/alerts.ts)')
    d.body('Structured Slack messages via Incoming Webhook — Block Kit + colour-coded attachments sidebar:')
    d.gap(4)
    d.table(
        ['Severity', 'Sidebar colour', 'Batching'],
        [
            ['critical', '#EF4444  red',   'None — sent on every occurrence'],
            ['warning',  '#F59E0B  amber', 'Slack: every occurrence. Email: 1/hour/type (see below)'],
        ],
        col_widths=[70, 130, 312],
    )
    d.gap(4)
    d.body('Each message: severity header with emoji, description, metadata fields, dashboard deep-link button.')
    d.gap(2)
    d.body('Transport: exponential backoff — 3 attempts at 1s → 2s → 4s. Never throws. No-ops if SLACK_WEBHOOK_URL is unset.')

    d.gap(8)
    d.h2('Admin Email Alerting  (src/lib/engine/notifications.ts — sendAdminAlert)')
    d.body('Sends HTML ops-alert emails to all ADMIN_EMAIL recipients via Resend:')
    d.gap(4)
    d.bullet('Critical: always sent immediately — no deduplication')
    d.bullet(
        'Warning: module-level Map<string, number> tracks last-sent timestamp per batchKey. '
        'At most one warning email per type per hour per process.'
    )
    d.bullet(
        'batchKey defaults to the alert title; set it explicitly (e.g. funding_phantom_balance) '
        'to batch by issue type rather than per-entity message.'
    )

    # ═══════════════════════════════════════════════════════════════════════════
    # CRON JOB  (new in v3)
    # ═══════════════════════════════════════════════════════════════════════════
    d.new_page('Cron Job')
    d.h1('Cron Job — Hourly Reconciliation  ·  NEW IN v3', section='Cron Job')
    d.body('/api/cron/reconcile — vercel.json schedule: 0 * * * * (every hour on the hour)', color=WHITE60)
    d.gap(4)
    d.note('Sub-daily cron frequency requires the Vercel Pro plan. Each invocation runs four phases in sequence.')
    d.gap(8)

    d.phase_card(1, 'Stuck-Run Detection', [
        'Query reconciliation_runs: status = running AND created_at < NOW() - 2 hours',
        'For each stuck run: update status → failed with error_message',
        'Fire CRITICAL Slack + email alert: "Stuck reconciliation run detected"',
    ])

    d.phase_card(2, 'Reconciliation Passes', [
        'Read RECONCILIATION_LOOKBACK_HOURS from env (default 72)',
        'Call runReconciliation({ windowHours }) — runs all 5 detection passes',
        'Window applied to DB queries (Passes 1-4) and PI results (Pass 5)',
    ])

    d.phase_card(3, 'New-Findings Alerting', [
        'Query: run_id = currentRunId AND created_at >= runStart AND severity IN (critical, high)',
        'created_at >= runStart identifies FIRST detection — upserts preserve original created_at',
        'Fire per-issue Slack + email alert. Warning emails batched by issue_type (1/hr/type).',
    ])

    d.phase_card(4, 'SLA Escalation', [
        'Query: severity = critical AND status IN (open, acknowledged) AND created_at < NOW() - 1 hour',
        'For each overdue issue: fire CRITICAL alert "UNRESOLVED CRITICAL: [type] for [entity]"',
        'Each issue has its own batchKey (sla_escalation:<issue_id>) — escalates every run until resolved',
    ])

    d.gap(8)
    d.h2('SLA Escalation Format')
    d.code([
        'UNRESOLVED CRITICAL: [issue_type] for [deal_id or entity]',
        '',
        'Example:',
        '  UNRESOLVED CRITICAL: funding_phantom_balance for deal_abc123',
    ])

    # ═══════════════════════════════════════════════════════════════════════════
    # KEY API ROUTES
    # ═══════════════════════════════════════════════════════════════════════════
    d.new_page('API Routes')
    d.h1('Key API Routes', section='API Routes')
    d.table(
        ['Route', 'Method', 'Auth', 'Purpose'],
        [
            ['/api/webhooks/stripe',                        'POST',     'Stripe sig',     'Stripe event ingestion'],
            ['/api/webhooks/docusign',                      'POST',     'DocuSign sig',   'DocuSign envelope events'],
            ['/api/ai/draw-review',                         'POST',     'Auth user',      'Request AI draw review'],
            ['/api/admin/ops/alerts',                       'GET',      'Admin + AAL2',   'Aggregated ops alert feed'],
            ['/api/admin/ops/release-health',               'GET',      'Admin + AAL2',   'Stuck releases + failed payouts'],
            ['/api/admin/ops/webhook-health',               'GET',      'Admin + AAL2',   'Stripe webhook pipeline health'],
            ['/api/admin/ops/search',                       'GET',      'Admin + AAL2',   'Full-text ops search'],
            ['/api/admin/milestones/:id/override-ai-review','POST',     'Admin + AAL2',   'Emergency AI override'],
            ['/api/admin/deals/:id/unfreeze',               'POST',     'Admin + AAL2',   'Unfreeze contract-voided deal'],
            ['/api/cron/reconcile',                         'GET/POST', 'CRON_SECRET',    'Hourly reconciliation cron'],
        ],
        col_widths=[188, 60, 90, 174],
    )

    # ═══════════════════════════════════════════════════════════════════════════
    # ENVIRONMENT VARIABLES
    # ═══════════════════════════════════════════════════════════════════════════
    d.gap(10)
    d.h1('Environment Variables', section='Configuration')
    d.h2('Deployment Checklist')
    required = [
        ('NEXT_PUBLIC_SUPABASE_URL',     'required', 'Supabase project URL'),
        ('NEXT_PUBLIC_SUPABASE_ANON_KEY','required', 'Supabase anon key'),
        ('SUPABASE_SERVICE_ROLE_KEY',    'required', 'Supabase service role key'),
        ('STRIPE_SECRET_KEY',            'required', 'Stripe secret key'),
        ('STRIPE_WEBHOOK_SECRET',        'required', 'Stripe webhook signing secret'),
        ('DOCUSIGN_ACCOUNT_ID',          'required', 'DocuSign account identifier'),
        ('DOCUSIGN_INTEGRATION_KEY',     'required', 'DocuSign app integration key'),
        ('DOCUSIGN_USER_ID',             'required', 'DocuSign user GUID'),
        ('DOCUSIGN_PRIVATE_KEY',         'required', 'DocuSign RSA private key'),
        ('DOCUSIGN_WEBHOOK_SECRET',      'required', 'DocuSign Connect HMAC secret'),
        ('PERPLEXITY_API_KEY',           'required', 'Draw review — primary AI provider'),
        ('ANTHROPIC_API_KEY',            'recommended','Draw review fallback (provider 2)'),
        ('OPENAI_API_KEY',               'recommended','Draw review fallback (provider 3)'),
        ('NEXT_PUBLIC_APP_URL',          'required', 'Production domain — used in emails + deep-links'),
        ('CRON_SECRET',                  'required', 'Vercel cron authentication token'),
        ('RESEND_API_KEY',               'required', 'Email delivery for ops alerts'),
        ('ADMIN_EMAIL',                  'required', 'Comma-separated ops alert recipients'),
        ('SLACK_WEBHOOK_URL',            'recommended','Slack Incoming Webhook for real-time alerts'),
        ('RECONCILIATION_LOOKBACK_HOURS','optional', 'Lookback window in hours (default 72)'),
        ('AI_ADMIN_OVERRIDE_TTL_HOURS',  'optional', 'AI override TTL in hours (default 4)'),
    ]

    def status_color(s):
        if s == 'required':     return RED
        if s == 'recommended':  return AMBER
        return WHITE40

    row_h = 15
    ty = d.y
    for var, status, desc in required:
        if ty - row_h < MB + 20:
            d.y = ty
            d.new_page()
            ty = d.y
        # bg alternating
        d.c.setFillColor(WHITE06)
        d.c.rect(ML, ty - row_h, CW, row_h, fill=1, stroke=0)
        # status dot
        sc = status_color(status)
        d.c.setFillColor(sc)
        d.c.circle(ML + 7, ty - row_h / 2, 3, fill=1, stroke=0)
        # var name
        d.c.setFont('Courier', 7.5)
        d.c.setFillColor(BLUE)
        d.c.drawString(ML + 16, ty - 10, var)
        # description
        d.c.setFont('Helvetica', 7.5)
        d.c.setFillColor(WHITE60)
        d.c.drawString(ML + 240, ty - 10, desc)
        ty -= row_h + 1

    d.y = ty - 6
    # Legend
    d.gap(8)
    lx = ML
    for label, col in [('Required', RED), ('Recommended', AMBER), ('Optional', WHITE40)]:
        d.c.setFillColor(col)
        d.c.circle(lx + 5, d.y + 3, 3, fill=1, stroke=0)
        d.c.setFont('Helvetica', 7.5)
        d.c.setFillColor(WHITE60)
        d.c.drawString(lx + 12, d.y, label)
        lx += 90
    d.y -= 12

    # ═══════════════════════════════════════════════════════════════════════════
    # DATABASE MIGRATIONS
    # ═══════════════════════════════════════════════════════════════════════════
    d.gap(10)
    d.h1('Database Migrations', section='Database')
    d.body('All migrations live in supabase/migrations/ and must be run in filename order.')
    d.gap(6)
    d.table(
        ['Migration file', 'What it adds'],
        [
            ['20260424000010_contract_uniqueness.sql',
             'Partial unique index on active contracts; deal_freeze_on_void, frozen_from_status columns; frozen state enum'],
        ],
        col_widths=[260, 252],
    )
    d.gap(6)
    d.code([
        '# Local reset (applies all migrations)',
        'supabase db reset',
        '',
        '# Incremental local push',
        'supabase db push',
        '',
        '# Production push',
        'supabase db push --db-url postgresql://postgres:[pw]@db.[ref].supabase.co:5432/postgres',
    ])

    # ═══════════════════════════════════════════════════════════════════════════
    # DEPLOYMENT
    # ═══════════════════════════════════════════════════════════════════════════
    d.gap(8)
    d.h1('Deployment', section='Deployment')
    d.h2('Vercel (recommended)')
    d.numbered([
        'Push your repo to GitHub',
        'Import the project at vercel.com/new',
        'Add ALL environment variables from the reference above in the Vercel dashboard',
        'Deploy',
        'After deployment: update webhook endpoint URLs in Stripe and DocuSign dashboards to your production domain',
    ])
    d.gap(6)
    d.note(
        'The hourly reconciliation cron (0 * * * *) requires a Vercel Pro plan. '
        'On Hobby, change the schedule to 0 2 * * * (daily) and note reduced visibility into financial drift.'
    )

    # ═══════════════════════════════════════════════════════════════════════════
    # CHANGELOG
    # ═══════════════════════════════════════════════════════════════════════════
    d.new_page('Changelog')
    d.h1('Changelog', section='Changelog')
    d.table(
        ['Version', 'Date', 'Summary'],
        [
            ['v3', '2026-04-24',
             'Reconciliation hardening: hourly cron, alerts.ts (Slack Block Kit + backoff), '
             'sendAdminAlert (warning batching 1/hr/type), cron route rewrite (stuck-run detection, '
             'RECONCILIATION_LOOKBACK_HOURS, new-findings alerting via created_at >= runStart, '
             'SLA escalation for critical issues > 1h), windowHours option in ReconciliationRunOptions, '
             'Pass 5 window applied to PI results'],
            ['v2', '2026-04-24',
             '10-condition gate; AI multi-provider chain; DocuSign webhook + contract enforcement; '
             'deal freeze on void; admin unfreeze endpoint; partial unique index on contracts; '
             'frozen deal state; admin audit log + Ops Dashboard; ops API cookie-forwarding fix; '
             'Ops Dashboard dark background fix; pitch deck (web + PDF)'],
            ['v1', '(initial)',
             '4-condition release gate; basic Stripe Connect; simple audit log'],
        ],
        col_widths=[44, 76, 392],
    )

    d.gap(16)
    # Sign-off
    d.c.setFont('Helvetica', 8)
    d.c.setFillColor(WHITE40)
    d.c.drawCentredString(PAGE_W / 2, d.y, 'Vektrum · Construction Payment Governance · Confidential')
    d.y -= 14
    d.c.setFont('Helvetica', 7.5)
    d.c.setFillColor(WHITE40)
    d.c.drawCentredString(PAGE_W / 2, d.y, 'Operating Manual v3 · 2026-04-24')

    d.save()


if __name__ == '__main__':
    build()
