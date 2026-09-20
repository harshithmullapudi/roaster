# Brand

Roster's logo is built on Superset's system rather than beside it.

## What Superset's logo actually is

Worth stating precisely, because "aligned with" is otherwise a matter of taste.
Superset's wordmark (`apps/marketing/…/SupersetLogo.tsx`) is not a typeface with
a pixel flavour — it is literally a grid of squares:

- **3 columns x 5 rows per glyph**, one blank column between letters.
- **Square cells only.** No curves, no diagonals, no rounded corners.
- One `<path>`, `fill="currentColor"`, no strokes.
- Its icon — four stepped chevrons — runs on a **finer 3x6 grid** than the
  letters, the two matched on height rather than on cell size. So a mark with
  its own resolution is native to the system, not a departure from it.

## What Roster does with it

- **Same 3x5 font.** `S`, `T`, `E` and `R` are the exact cell patterns decoded
  from Superset's own wordmark path, so the two are the same typeface rather
  than a lookalike. `O` is new, built to match Superset's `U`.
- **The mark is four cells on a roster** — two filled, two open. People and
  agents, the same list, the same standing. It is the one thing this product
  can say that a generic chat app cannot.
- **The mark is 7x7 against the wordmark's 5**, because an open member needs a
  3x3 cell to have a centre. Heights are matched by giving mark cells 5 units
  and letter cells 7, so both land on 35 and every edge stays on a whole pixel
  — the same relationship Superset's 6-tall icon has to its 5-tall caps.
- **App icons use Superset's ground**, `#161512`, with the glyph in `#e9e9e9`.

## The mark is not the sigil

`#` is still everywhere in the product, because it means channel. The sidebar,
the channel header and the mention list all render it through `HashMark`, and
that stays a hash — `# marketing` would be nonsense with anything else in front
of it. `RosterMark` is the brand; `HashMark` is a piece of the interface. They
are separate paths in `logo-paths.ts` for exactly that reason.

## Files

Everything is generated. Do not hand-edit the SVGs or PNGs.

```bash
python3 scripts/generate-logo.py     # no dependencies
```

| File | Grid | Use |
| --- | --- | --- |
| `apps/web/public/brand/roster-lockup.svg` / `.png` | 210x35 | Mark + ROSTER. Default where there's room. |
| `apps/web/public/brand/roster-wordmark.svg` / `.png` | 23x5 | ROSTER alone. |
| `apps/web/public/brand/roster-mark.svg` / `.png` | 7x7 | The mark alone. |
| `apps/web/public/brand/roster-icon.svg` | 9x9 | Square app icon with margin. |
| `apps/web/src/app/icon.png` | 9x9 @ 360px | Favicon. Next picks it up by filename. |
| `apps/web/src/app/apple-icon.png` | 9x9 @ 180px | Touch icon. |
| `apps/web/public/brand/roster-icon-512.png` | 512px | For anywhere the icon is uploaded rather than served — the Railway template, a GitHub avatar. |
| `apps/tauri/src-tauri/icons/*` | — | Desktop app icons, including `icon.icns` and `icon.ico`. |
| `apps/tauri/app-icon.png` | 1024px | Tauri's source icon. |
| `apps/web/src/utils/logo-paths.ts` | — | The React paths, emitted by the same script so they cannot drift. |
| `apps/web/public/brand/_contact-sheet.png` | — | Every size on one page, for eyeballing. |

## Two icon shapes, on purpose

**macOS is not full-bleed.** Apple's template is a 1024 canvas with an 824
rounded tile inside it, so ~100px on every side is *transparent* — the Dock
draws that gap and it is not ours to fill. Ship a full-bleed square and macOS
renders a hard-cornered slab standing proud of every neighbour, which is what
0.1.2 did.

The corner is continuous curvature, not a circular arc — a superellipse
quadrant. The figure quoted everywhere is "radius 185.4 on an 824 tile" (22.5%),
but that is the *apparent* radius: what you measure if you assume an arc and
find where the straight edge begins. Fitting the real outline of a system icon
(`Notes.app`, decoded and least-squares fitted across its corner profile) gives
**exponent 3.0 at a radius of 31.6% of the tile**, to within 1px RMS. The two
agree — push 31.6%/n=3 back through the apparent-radius measurement and 21.8%
comes out. Build from 22.5% with n=5 and the corner is visibly tighter than
every icon beside it.

**Everything else stays full-bleed**, also on purpose. iOS masks the touch icon
itself and double-rounds anything pre-rounded, Windows tiles are square, and a
favicon is drawn in a square box. Only `icon.icns` gets the tile.

Flat icons put the mark at 7 cells of 12. Mac icons put it at 54.5% of the tile.
Desktop sizes are fixed by Tauri and Windows and most are not multiples of
either grid, so each takes the largest whole-pixel cell that fits and centres
it. The leftover becomes ground — cells never land on fractions.

If you change the shape, re-run the comparison: render a size, decode a system
icon, and check the tile fraction, margin and corner profile line up.

In React, use the components in `apps/web/src/components/logo/` —
`RosterLockup`, `RosterWordmark`, `RosterMark`, and `HashMark` for the channel
sigil. All of them take `currentColor`, so they inherit whatever text colour
they sit in and work in light and dark without a variant.

## Rules

- **Colour comes from `currentColor`.** There is no brand colour in the logo and
  there shouldn't be — it is the same mark on every background.
- **Scale by whole cells** where you can. The PNGs are all exact integer
  multiples of the grid, so the squares stay crisp with no resampling.
- **Don't add effects.** No gradients, shadows, or outline variants. The grid
  is the identity; softening it removes the only thing that ties it to
  Superset. The one rounded corner in the system is the macOS tile, which is
  the platform's shape rather than ours — never round the mark itself.
- **Minimum sizes**, from the contact sheet: the lockup stops being legible
  below roughly 14px tall and the wordmark below 12px. The mark holds down to
  16px square, where the open members are still a cell wide — below that, the
  two kinds of member stop being distinguishable and it reads as four blocks.
