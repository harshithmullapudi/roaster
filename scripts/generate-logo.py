"""
Roster logo generator.

Superset's logo is a pixel-grid system: every glyph is square cells, no curves,
one blank column between letters, `fill="currentColor"`. Its wordmark runs on a
3x5 grid and its icon — four stepped chevrons — on a finer 3x6 one, the two
matched on height rather than on cell size. Roster follows both rules.

Glyph shapes for S, T, E, R are decoded cell-for-cell from Superset's own
wordmark path so the two read as the same typeface. O is new, built to match U.

The mark is four cells on a roster: two filled, two open. People and agents, the
same list, the same standing. It needs 3x3 per member for the open ones to have
a centre, so the mark is a 7x7 grid against the wordmark's 5 — the same
relationship Superset's own 6-tall icon has to its 5-tall caps. Heights are
matched by giving the mark 5-unit cells and the letters 7-unit ones, so both
land on a 35-unit height and every edge stays on a whole pixel.
"""

import struct
import subprocess
import tempfile
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

# The mark: two members filled, two open, on one roster.
MARK = [
    "XXX.XXX",
    "XXX.X.X",
    "XXX.XXX",
    ".......",
    "XXX.XXX",
    "X.X.XXX",
    "XXX.XXX",
]

# The channel sigil. Not the logo — this is the `#` the UI puts before a
# channel name, and it stays a hash because that is what it means.
HASH = [
    ".X.X.",
    "XXXXX",
    ".X.X.",
    "XXXXX",
    ".X.X.",
]

LETTER_GAP = 1  # blank columns between letters, as in Superset's wordmark
LOCKUP_GAP = 2  # blank letter-columns between mark and wordmark

MARK_CELL = 5  # mark cells, in common units
LETTER_CELL = 7  # letter cells, in common units — 7x5 == 5x7, so heights match
ICON_MARGIN = 1  # cells of ground around the mark in the square app icon


def cells(rows, ox=0, oy=0):
    """Grid rows -> list of (x, y) filled cells."""
    return [
        (ox + x, oy + y)
        for y, row in enumerate(rows)
        for x, ch in enumerate(row)
        if ch == "X"
    ]


def scaled(cells_, cell, ox=0, oy=0):
    """Cells -> (x, y, size) boxes in common units."""
    return [(ox + x * cell, oy + y * cell, cell) for x, y in cells_]


def word(text):
    """Lay out text in the pixel font. Returns (cells, width, height) in cells."""
    out, x = [], 0
    for i, ch in enumerate(text):
        if i:
            x += LETTER_GAP
        out += cells(GLYPHS[ch], ox=x)
        x += len(GLYPHS[ch][0])
    return out, x, 5


def lockup(text):
    """Mark + wordmark, matched on height. Returns (boxes, width, height)."""
    mark_w = len(MARK[0]) * MARK_CELL
    wm, wm_cells_w, _ = word(text)
    gap = LOCKUP_GAP * LETTER_CELL
    boxes = scaled(cells(MARK), MARK_CELL)
    boxes += scaled(wm, LETTER_CELL, ox=mark_w + gap)
    return boxes, mark_w + gap + wm_cells_w * LETTER_CELL, len(MARK) * MARK_CELL


# ----------------------------------------------------------------- svg output


def svg_boxes(boxes, w, h, title, pad=0):
    """One <path> of square cells, exactly as Superset builds its wordmark."""
    d = "".join(
        f"M{x + pad} {y + pad}H{x + pad + s}V{y + pad + s}H{x + pad}Z"
        for x, y, s in boxes
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {w + pad * 2} {h + pad * 2}" fill="none" '
        f'role="img" aria-label="{title}">\n'
        f"  <title>{title}</title>\n"
        f'  <path d="{d}" fill="currentColor" shape-rendering="crispEdges"/>\n'
        f"</svg>\n"
    )


def path_of(boxes, pad=0):
    return "".join(
        f"M{x + pad} {y + pad}H{x + pad + s}V{y + pad + s}H{x + pad}Z"
        for x, y, s in boxes
    )


# ----------------------------------------------------------------- png output


def png_bytes(pixels, w, h):
    """Minimal PNG encoder. RGBA, no filtering — exact for pixel art."""
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

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def png(path, pixels, w, h):
    path.write_bytes(png_bytes(pixels, w, h))


def canvas(w, h, bg):
    return [[list(bg) for _ in range(w)] for _ in range(h)]


def draw(pixels, cells_, scale, fg, ox=0, oy=0, bounds=None):
    W, H = (bounds or (len(pixels[0]), len(pixels)))
    for cx, cy in cells_:
        for y in range(oy + cy * scale, oy + (cy + 1) * scale):
            for x in range(ox + cx * scale, ox + (cx + 1) * scale):
                if 0 <= y < H and 0 <= x < W:
                    pixels[y][x] = list(fg)


def render(path, cells_, gw, gh, scale, fg, bg=None, pad=0):
    """Draw a cell grid to a PNG at `scale` device pixels per cell."""
    W, H = (gw + pad * 2) * scale, (gh + pad * 2) * scale
    pixels = canvas(W, H, bg if bg else (0, 0, 0, 0))
    draw(pixels, cells_, scale, fg, ox=pad * scale, oy=pad * scale)
    png(path, pixels, W, H)


def icon_pixels(size, fg, bg):
    """Square app icon at an exact pixel size.

    Cells are always whole pixels — the largest that fits with a 1-cell margin,
    falling back to no margin when the size is too small for one. Whatever is
    left over becomes extra ground, so the mark stays crisp and centred instead
    of being resampled onto fractional cells.
    """
    mw = len(MARK[0])
    for margin in (ICON_MARGIN, 0):
        cell = size // (mw + margin * 2)
        if cell >= 2 or margin == 0:
            break
    cell = max(1, cell)
    drawn = mw * cell
    off = (size - drawn) // 2
    pixels = canvas(size, size, bg)
    draw(pixels, cells(MARK), cell, fg, ox=off, oy=off)
    return pixels


def icon_png(size, fg, bg):
    return png_bytes(icon_pixels(size, fg, bg), size, size)


# ------------------------------------------------------------- ico and icns


def write_ico(path, sizes, fg, bg):
    """ICO with PNG-encoded entries, which every target since Vista reads."""
    images = [(s, icon_png(s, fg, bg)) for s in sizes]
    header = struct.pack("<HHH", 0, 1, len(images))
    offset = 6 + 16 * len(images)
    entries, blobs = b"", b""
    for s, blob in images:
        entries += struct.pack(
            "<BBBBHHII", s if s < 256 else 0, s if s < 256 else 0, 0, 0, 1, 32,
            len(blob), offset,
        )
        blobs += blob
        offset += len(blob)
    path.write_bytes(header + entries + blobs)


def write_icns(path, fg, bg):
    """Built with macOS iconutil so the result is exactly what Apple expects."""
    pairs = [
        ("icon_16x16.png", 16), ("icon_16x16@2x.png", 32),
        ("icon_32x32.png", 32), ("icon_32x32@2x.png", 64),
        ("icon_128x128.png", 128), ("icon_128x128@2x.png", 256),
        ("icon_256x256.png", 256), ("icon_256x256@2x.png", 512),
        ("icon_512x512.png", 512), ("icon_512x512@2x.png", 1024),
    ]
    with tempfile.TemporaryDirectory() as tmp:
        iconset = Path(tmp) / "roster.iconset"
        iconset.mkdir()
        for name, size in pairs:
            (iconset / name).write_bytes(icon_png(size, fg, bg))
        subprocess.run(
            ["iconutil", "-c", "icns", str(iconset), "-o", str(path)], check=True
        )


# --------------------------------------------------------------------- build

FG = (32, 32, 32, 255)  # core's --gray-950
DARK_BG = (22, 21, 18, 255)  # Superset's favicon ground
LIGHT_FG = (233, 233, 233, 255)

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "apps" / "web"
TAURI = ROOT / "apps" / "tauri"
out = WEB / "public" / "brand"
out.mkdir(parents=True, exist_ok=True)
app = WEB / "src" / "app"

mark_cells = cells(MARK)
mark_w, mark_h = len(MARK[0]), len(MARK)
hash_cells = cells(HASH)
hash_w, hash_h = len(HASH[0]), len(HASH)
wm, wm_w, wm_h = word("ROSTER")
lk, lk_w, lk_h = lockup("ROSTER")

mark_boxes = scaled(mark_cells, 1)
hash_boxes = scaled(hash_cells, 1)
wm_boxes = scaled(wm, 1)

(out / "roster-mark.svg").write_text(svg_boxes(mark_boxes, mark_w, mark_h, "Roster"))
(out / "roster-wordmark.svg").write_text(svg_boxes(wm_boxes, wm_w, wm_h, "Roster"))
(out / "roster-lockup.svg").write_text(svg_boxes(lk, lk_w, lk_h, "Roster"))
# Square app-icon SVG: same margin as the PNG icons.
(out / "roster-icon.svg").write_text(
    svg_boxes(mark_boxes, mark_w, mark_h, "Roster", pad=ICON_MARGIN)
)

render(out / "roster-mark.png", mark_cells, mark_w, mark_h, 100, FG)
render(out / "roster-wordmark.png", wm, wm_w, wm_h, 40, FG)
# The lockup PNG needs the two cell sizes, so it is drawn rather than rendered.
LK_SCALE = 4
lk_px = canvas(lk_w * LK_SCALE, lk_h * LK_SCALE, (0, 0, 0, 0))
for x, y, s in lk:
    for py in range(y * LK_SCALE, (y + s) * LK_SCALE):
        for px in range(x * LK_SCALE, (x + s) * LK_SCALE):
            lk_px[py][px] = list(FG)
png(out / "roster-lockup.png", lk_px, lk_w * LK_SCALE, lk_h * LK_SCALE)

# Web icons: light glyph on Superset's dark ground, on the 9-cell icon grid.
ICON_GRID = mark_w + ICON_MARGIN * 2
for path, scale in (
    (app / "icon.png", 40),  # 360px
    (app / "apple-icon.png", 20),  # 180px, the size Apple asks for
    (out / "roster-icon-72.png", 8),
):
    render(path, mark_cells, mark_w, mark_h, scale, LIGHT_FG, DARK_BG, ICON_MARGIN)

# For anywhere the icon has to be uploaded rather than served: the Railway
# template, a GitHub org avatar, an app directory listing.
(out / "roster-icon-512.png").write_bytes(icon_png(512, LIGHT_FG, DARK_BG))

# Desktop app icons. Sizes are fixed by Tauri and Windows, so each one takes the
# largest whole-pixel cell that fits and centres it.
icons = TAURI / "src-tauri" / "icons"
icons.mkdir(parents=True, exist_ok=True)
for name, size in (
    ("32x32.png", 32), ("64x64.png", 64), ("128x128.png", 128),
    ("128x128@2x.png", 256), ("icon.png", 512),
    ("Square30x30Logo.png", 30), ("Square44x44Logo.png", 44),
    ("Square71x71Logo.png", 71), ("Square89x89Logo.png", 89),
    ("Square107x107Logo.png", 107), ("Square142x142Logo.png", 142),
    ("Square150x150Logo.png", 150), ("Square284x284Logo.png", 284),
    ("Square310x310Logo.png", 310), ("StoreLogo.png", 50),
):
    (icons / name).write_bytes(icon_png(size, LIGHT_FG, DARK_BG))

write_ico(icons / "icon.ico", [16, 32, 48, 64, 128, 256], LIGHT_FG, DARK_BG)
write_icns(icons / "icon.icns", LIGHT_FG, DARK_BG)
(TAURI / "app-icon.png").write_bytes(icon_png(1024, LIGHT_FG, DARK_BG))

# The React paths, emitted here so they cannot drift from the generated assets.
(WEB / "src" / "utils" / "logo-paths.ts").write_text(
    "// Generated by scripts/generate-logo.py. Do not edit by hand.\n\n"
    f'export const MARK_PATH =\n  "{path_of(mark_boxes)}";\n'
    f"export const MARK_VIEWBOX = \"0 0 {mark_w} {mark_h}\";\n\n"
    f'export const HASH_PATH =\n  "{path_of(hash_boxes)}";\n'
    f"export const HASH_VIEWBOX = \"0 0 {hash_w} {hash_h}\";\n\n"
    f'export const WORDMARK_PATH =\n  "{path_of(wm_boxes)}";\n'
    f"export const WORDMARK_VIEWBOX = \"0 0 {wm_w} {wm_h}\";\n\n"
    f'export const LOCKUP_PATH =\n  "{path_of(lk)}";\n'
    f"export const LOCKUP_VIEWBOX = \"0 0 {lk_w} {lk_h}\";\n"
)

# Contact sheet so the result can actually be looked at — every size on one
# page, including the ones small enough to stop being legible.
sheet_w, sheet_h = 960, 460
sheet = canvas(sheet_w, sheet_h, (250, 250, 250, 255))


def blit_boxes(boxes, ox, oy, scale, fg):
    for cx, cy, s in boxes:
        for y in range(oy + cy * scale, oy + (cy + s) * scale):
            for x in range(ox + cx * scale, ox + (cx + s) * scale):
                if 0 <= y < sheet_h and 0 <= x < sheet_w:
                    sheet[y][x] = list(fg)


blit_boxes(lk, 60, 40, 3, FG)  # lockup, large
blit_boxes(wm_boxes, 60, 180, 14, FG)  # wordmark, medium
blit_boxes(mark_boxes, 640, 150, 24, FG)  # mark, large
blit_boxes(hash_boxes, 830, 168, 24, (150, 150, 150, 255))  # sigil, for reference

# App icon at four sizes, each rendered exactly as it ships.
x0 = 60
for size in (128, 64, 32, 16):
    px = icon_pixels(size, LIGHT_FG, DARK_BG)
    for y in range(size):
        for x in range(size):
            sheet[300 + y][x0 + x] = px[y][x]
    x0 += size + 20

blit_boxes(wm_boxes, 480, 330, 6, FG)  # wordmark, tiny — legibility check
blit_boxes(lk, 480, 370, 1, FG)  # lockup, tiny

png(out / "_contact-sheet.png", sheet, sheet_w, sheet_h)

print(f"mark grid: {mark_w}x{mark_h}   icon grid: {ICON_GRID}x{ICON_GRID}")
print(f"wordmark: {wm_w}x{wm_h} cells   lockup: {lk_w}x{lk_h} units")
for f in sorted(out.iterdir()):
    print(f"  brand/{f.name:24} {f.stat().st_size:>8,} bytes")
for f in sorted(icons.iterdir()):
    print(f"  tauri/{f.name:24} {f.stat().st_size:>8,} bytes")
