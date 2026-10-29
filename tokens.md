# Tokens

The canonical values for the interface. CSS custom properties live on `:root` in
`src/styles.css` (the hallway adds a few scene colours on `.entry` in `src/entry/entry.css`).
Use the variable, not the hex.

## Colour

| Token | Value | Use |
|---|---|---|
| `--ink-deep` | `#2b170a` | Darkest text on parchment; outlines on gold |
| `--ink-warm` | `#3a2412` | Body text on parchment |
| `--ink-on-gold` | `#2a1404` | Text and icons on gold buttons |
| `--bark` | `#4a2810` | Number chips, quiet buttons on parchment |
| `--umber` | `#5b3d22` | Secondary text on parchment |
| `--umber-light` | `#6b4a2a` | Meta text on parchment |
| `--rust-ink` | `#7a3e1c` | Calls to action in text ("Click the wheel…") |
| `--cream` | `#f6e3bd` | Text on dark panels |
| `--ivory` | `#fff4dc` | Highlights on dark (current direction, you-are-here) |
| `--sand-light` | `#f1d9ae` | Display text over the 3D scene |
| `--gold-leaf` | `#f2c862` | Stops, progress, active state |
| `--gold-light` | `#f6dc84` | Gold highlights, the playing sentence |
| `--gold-deep` | `#e8b04a` | Focus rings, glows |
| `--gold` / `--gold-soft` | `#f2b84b` / `#ffd98a` | Headings on dark panels |
| `--saffron` | `#e8894a` | North, the live site's inlay |
| `--panel` | `rgba(34, 22, 14, 0.82)` | Dark glass panels over the scene (with `backdrop-filter: blur`) |
| `--panel-solid` | `#22160e` | The same, opaque |
| `--text` / `--muted` | `#f6ead8` / `#cdb89c` | Text / secondary text on dark panels |
| `--legend` / `--tradition` | `#b0476b` / `#4c7d8f` | "Legend" and "Tradition" badges only |

## Type

Two families only: `--display` (Cormorant Garamond) for names and headings, `--body`
(DM Sans) for everything else. Hindi and Odia fall back to system fonts.

| Step | Size | Use |
|---|---|---|
| Hero | `clamp(2.6rem, 6.4vw, 5.4rem)` / 600 | Hallway title |
| Title | 2.5rem / 700 display | Site name on the welcome scroll |
| Heading | 1.75rem / 700 display | Story heading |
| Body | 1rem / 1.6 | Story text |
| Small | 0.85–0.92rem | Captions, hover-card lines |
| Caption | 0.72–0.76rem | Credits, meta, kickers (uppercase, tracked 0.14em) |

Nothing below 0.68rem.

## Shape

- Pills and round buttons: `999px` / `50%`.
- Panels: `14–16px`. A panel docked to an edge loses its radius on that side.
- Icon buttons: 34px (secondary), 44–46px (primary).
- Shadows are warm and dark: `rgba(0, 0, 0, 0.45–0.55)`, never grey or blue.
