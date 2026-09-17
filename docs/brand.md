# Brand

Roster's logo is built on Superset's system rather than beside it.

## What Superset's logo actually is

Worth stating precisely, because "aligned with" is otherwise a matter of taste.
Superset's wordmark (`apps/marketing/…/SupersetLogo.tsx`) is not a typeface with
a pixel flavour — it is literally a grid of squares:

- **3 columns x 5 rows per glyph**, one blank column between letters.
- **Square cells only.** No curves, no diagonals, no rounded corners.
- One `<path>`, `fill="currentColor"`, no strokes.
- Its icon is **punctuation drawn in the same grid** — `{()}` — not a picture
  of anything.

## What Roster does with it

- **Same 3x5 font.** `S`, `T`, `E` and `R` are the exact cell patterns decoded
  from Superset's own wordmark path, so the two are the same typeface rather
  than a lookalike. `O` is new, built to match Superset's `U`.
- **The mark is `#`**, on the same grid. It is the channel sigil, so it says
  what the product is at a glance — and it keeps Superset's rule that the icon
  is a piece of punctuation, not an illustration.
- **App icons use Superset's ground**, `#161512`, with the glyph in `#e9e9e9`.

## Files

Everything is generated. Do not hand-edit the SVGs or PNGs.

```bash
python3 scripts/generate-logo.py     # no dependencies
```

| File | Grid | Use |
| --- | --- | --- |
| `apps/web/public/brand/roster-lockup.svg` / `.png` | 30x5 | `#` + ROSTER. Default where there's room. |
| `apps/web/public/brand/roster-wordmark.svg` / `.png` | 23x5 | ROSTER alone. |
| `apps/web/public/brand/roster-mark.svg` / `.png` | 5x5 | `#` alone. |
| `apps/web/public/brand/roster-icon.svg` | 9x9 | Square app icon with margin. |
| `apps/web/src/app/icon.png` | 9x9 @ 360px | Favicon. Next picks it up by filename. |
| `apps/web/src/app/apple-icon.png` | 9x9 @ 180px | Touch icon. |
| `apps/web/public/brand/_contact-sheet.png` | — | Every size on one page, for eyeballing. |

In React, use `apps/web/src/components/roster-logo.tsx` — `RosterLockup`,
`RosterWordmark`, `RosterMark`. All three take `currentColor`, so they inherit
whatever text colour they sit in and work in light and dark without a variant.

## Rules

- **Colour comes from `currentColor`.** There is no brand colour in the logo and
  there shouldn't be — it is the same mark on every background.
- **Scale by whole cells** where you can. The PNGs are all exact integer
  multiples of the grid, so the squares stay crisp with no resampling.
- **Don't add effects.** No gradients, shadows, rounded corners, or outline
  variants. The grid is the identity; softening it removes the only thing that
  ties it to Superset.
- **Minimum sizes**, from the contact sheet: the lockup stops being legible
  below roughly 14px tall, the wordmark below 12px, the mark below 16px square.
  Use the mark alone below that.
