"""
Roster logo generator.

Superset's logo is a 3x5 pixel-grid font: every glyph is square cells, no
curves, one blank column between letters, `fill="currentColor"`. Its icon is
punctuation drawn in the same grid — `{()}`. Roster follows both rules: the
same 3x5 caps for the wordmark, and `#` (the channel sigil) as the mark.

Glyph shapes for S, T, E, R are decoded cell-for-cell from Superset's own
wordmark path so the two read as the same typeface. O is new, built to match U.
"""

import struct
import zlib
from pathlib import Path

# ---------------------------------------------------------------- glyph data

GLYPHS = {
    # Decoded from Superset's wordmark.
    "S": ["XXX", "X..", "XXX", "..X", "XXX"],
    "T": ["XXX", ".X.", ".X.", ".X.", ".X."],
    "E": ["XXX", "X..", "XX.", "X..", "XXX"],
    "R": ["XXX", "X.X", "XX.", "X.X", "X.X"],
    # New, built to match Superset's U ("X.X" x4 + "XXX").
    "O": ["XXX", "X.X", "X.X", "X.X", "XXX"],
}

# The mark: `#`, the channel sigil, on the same grid.
MARK = [
    ".X.X.",
    "XXXXX",
    ".X.X.",
    "XXXXX",
    ".X.X.",
]

LETTER_GAP = 1  # blank columns between letters, as in Superset's wordmark
LOCKUP_GAP = 2  # blank columns between mark and wordmark


def cells(rows, ox=0, oy=0):
    """Grid rows -> list of (x, y) filled cells."""
    return [
        (ox + x, oy + y)
        for y, row in enumerate(rows)
        for x, ch in enumerate(row)
        if ch == "X"
    ]


def word(text):
    """Lay out text in the pixel font. Returns (cells, width, height)."""
    out, x = [], 0
    for i, ch in enumerate(text):
        if i:
            x += LETTER_GAP
        out += cells(GLYPHS[ch], ox=x)
        x += len(GLYPHS[ch][0])
    return out, x, 5


def lockup(text):
    mark = cells(MARK)
    mw = len(MARK[0])
    w, ww, _ = word(text)
    shifted = [(x + mw + LOCKUP_GAP, y) for x, y in w]
    return mark + shifted, mw + LOCKUP_GAP + ww, 5


# ----------------------------------------------------------------- svg output


def svg(cells_, w, h, title, pad=0):
    """One <path> of square cells, exactly as Superset builds its wordmark."""
    d = "".join(
        f"M{x + pad} {y + pad}H{x + pad + 1}V{y + pad + 1}H{x + pad}Z"
        for x, y in cells_
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {w + pad * 2} {h + pad * 2}" fill="none" '
        f'role="img" aria-label="{title}">\n'
        f"  <title>{title}</title>\n"
        f'  <path d="{d}" fill="currentColor" shape-rendering="crispEdges"/>\n'
        f"</svg>\n"
    )


# ----------------------------------------------------------------- png output


def png(path, pixels, w, h):
    """Minimal PNG writer. RGBA, no filtering — exact for pixel art."""
    raw = b"".join(
        b"\x00" + b"".join(bytes(pixels[y][x]) for x in range(w)) for y in range(h)
    )

    def chunk(tag, data):
        body = tag + data
        return (
            struct.pack(">I", len(data))
            + body
            + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)
        )

    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def render(path, cells_, gw, gh, scale, fg, bg=None, pad=0):
    """Draw a cell grid to a PNG at `scale` device pixels per cell."""
    W, H = (gw + pad * 2) * scale, (gh + pad * 2) * scale
    base = bg if bg else (0, 0, 0, 0)
    pixels = [[list(base) for _ in range(W)] for _ in range(H)]
    for cx, cy in cells_:
        for y in range((cy + pad) * scale, (cy + pad + 1) * scale):
            for x in range((cx + pad) * scale, (cx + pad + 1) * scale):
                pixels[y][x] = list(fg)
    png(path, pixels, W, H)


# --------------------------------------------------------------------- build

FG = (32, 32, 32, 255)  # core's --gray-950
DARK_BG = (22, 21, 18, 255)  # Superset's favicon ground
LIGHT_FG = (233, 233, 233, 255)

WEB = Path(__file__).resolve().parent.parent / "apps" / "web"
out = WEB / "public" / "brand"
out.mkdir(parents=True, exist_ok=True)
app = WEB / "src" / "app"

mark = cells(MARK)
mark_w, mark_h = len(MARK[0]), len(MARK)
wm, wm_w, wm_h = word("ROSTER")
lk, lk_w, lk_h = lockup("ROSTER")

(out / "roster-mark.svg").write_text(svg(mark, mark_w, mark_h, "Roster"))
(out / "roster-wordmark.svg").write_text(svg(wm, wm_w, wm_h, "Roster"))
(out / "roster-lockup.svg").write_text(svg(lk, lk_w, lk_h, "Roster"))
# Square app-icon SVG: same 2-cell margin as the PNG icons.
(out / "roster-icon.svg").write_text(svg(mark, mark_w, mark_h, "Roster", pad=2))

render(out / "roster-mark.png", mark, mark_w, mark_h, 100, FG)
render(out / "roster-wordmark.png", wm, wm_w, wm_h, 40, FG)
render(out / "roster-lockup.png", lk, lk_w, lk_h, 40, FG)

# App icons: light glyph on Superset's dark ground. 2 cells of margin, so the
# mark occupies 5/9 of the square — Superset's favicon sits at roughly the same
# ratio, and 1 cell crowded the edges. Every size is an exact multiple of the
# 9-cell grid, so the squares stay crisp with no resampling.
for path, scale in (
    (app / "icon.png", 40),  # 360px
    (app / "apple-icon.png", 20),  # 180px, the size Apple asks for
    (out / "roster-icon-72.png", 8),
):
    render(path, mark, mark_w, mark_h, scale, LIGHT_FG, DARK_BG, 2)

# Contact sheet so the result can actually be looked at — every size on one
# page, including the ones small enough to stop being legible.
sheet_w, sheet_h = 960, 420
sheet = [[[250, 250, 250, 255] for _ in range(sheet_w)] for _ in range(sheet_h)]


def blit(cells_, ox, oy, scale, fg):
    for cx, cy in cells_:
        for y in range(oy + cy * scale, oy + (cy + 1) * scale):
            for x in range(ox + cx * scale, ox + (cx + 1) * scale):
                if 0 <= y < sheet_h and 0 <= x < sheet_w:
                    sheet[y][x] = list(fg)


def panel(x0, y0, x1, y1, color):
    for y in range(y0, y1):
        for x in range(x0, x1):
            sheet[y][x] = list(color)


blit(lk, 60, 50, 22, FG)  # lockup, large
blit(wm, 60, 200, 14, FG)  # wordmark, medium
blit(mark, 620, 170, 34, FG)  # mark, large

# App icon at three sizes, each on its 9x9 dark ground.
for i, (s, x0) in enumerate(((12, 60), (8, 200), (4, 300))):
    panel(x0, 300, x0 + 9 * s, 300 + 9 * s, DARK_BG)
    blit(mark, x0 + 2 * s, 300 + 2 * s, s, LIGHT_FG)

blit(wm, 400, 330, 6, FG)  # wordmark, tiny — legibility check
blit(lk, 400, 370, 4, FG)  # lockup, tiny

png(out / "_contact-sheet.png", sheet, sheet_w, sheet_h)

print(f"wordmark grid: {wm_w}x{wm_h}   lockup grid: {lk_w}x{lk_h}")
for f in sorted(out.iterdir()):
    print(f"  {f.name:24} {f.stat().st_size:>7,} bytes")
