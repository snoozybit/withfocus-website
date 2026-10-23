# Focus logo

## Idea
**What is in focus spells F.** A 3×3 grid stands for everything a team and its agents are working on. The cells in focus are solid circles, and they form an **F**: the stem runs down the middle column and the arms reach right. The F's top arm ends in the **picked dot**, lifted out of its slot. That dot is the one thing that needs you. Everything else is out of focus, drawn as hairline rounded-square frames. The dots also grow toward the picked corner, like a lens pulling focus.

Approved by Lalit on 2026-10-24 (round 11). Reviews: https://claude.ai/artifact/S2PrFcCqRuGQXRwjF2gvyk

## Files
| File | Use |
|---|---|
| `focus-mark.svg` | Master mark, `fill="currentColor"`. Inline it wherever colour comes from CSS |
| `focus-mark-symbol.svg` | The same mark as `<symbol id="focus-mark">` for `<svg><use href="#focus-mark"/></svg>` slots |
| `focus-mark-green.svg` / `-mist` / `-forest` / `-black` / `-white` | Fixed-colour versions |
| `focus-mark-animated.svg` (+ `-green` / `-mist` / `-forest`) | Animated mark (see Motion). Works inline or as an `<img>` |
| `focus-lockup.svg` / `-mist` / `-forest` | Mark + "Focus" wordmark (Inter SemiBold, OFL, converted to outlines) |
| `favicon.svg` | Browser tab: the F and the picked dot only, on a Green Deep squircle |
| `app-icon.svg`, `app-icon-forest.svg` | App icon sources, squircle tile, mark optically centred |
| `png/app-icon-{1024,512,192,180}.png`, `png/app-icon-forest-1024.png`, `png/favicon-{32,48}.png` | Raster exports: 180 for apple-touch-icon, 192 and 512 for the web manifest, 1024 for the app stores |

## Construction (24-unit grid)
- 3×3 grid, pitch 6.6 units. Row A is the top, column 1 is the left.
- **In focus (solid circles):** A2, B2, B3, C2, plus the picked dot that leaves slot A3. The picked dot (r = 3.0) sits +2.7 / −3.7 units from its empty slot.
- **Out of focus (hairline frames):** A1, B1, C1, C3. Each frame is a rounded square with side = 0.89 × the circle's diameter, so it matches optically. The corner radius is 50% of the half-side, and the frame thickness is max(0.32 units, 16% of r).
- **Focus pull:** the radius grows toward the picked corner, r = 0.85 + 1.7 × (closeness / 0.75)^1.35, where closeness = (column + (2 − row)) / 4 for 0-based row and column.
- Fills only, with no strokes. The frames use `fill-rule="evenodd"`. The whole composition is centred on its bounding box.

## Colour
| Role | Hex | Contrast |
|---|---|---|
| Focus Green: the mark on forest | `#6FA585` | 5.2:1 on forest |
| Green Deep: tiles under a mist mark (favicon, app icon) | `#3D7154` | 5.7:1 with white |
| Forest: ground | `#1C2B1E` | |
| Mist: the mark on Green Deep or forest | `#F0F4EF` | |

On the site, the mark can also be sage-light `#C8D9C4` on forest (about 10:1). The UI designer tests that against Focus Green.

## Size and clear space
- **Clear space:** one grid pitch (6.6 units, about 27% of the mark's height) on every side.
- **Minimum size:** the full mark (with frames) at 32px; the lockup at 96px wide. Below 32px, use `favicon.svg` or the F-only cut, because the hairline frames disappear.
- **Background:** the frames are hairline, so keep the mark on calm, flat fields. Never place it over busy photos.

## Motion (`focus-mark-animated.svg`)
3.2s, looping:
1. **0–0.3s:** rest. Every cell is a hairline circle and the F is dim (scale 0.6, opacity 0.35).
2. **0.3–1.0s:** the F lights up, starting at the bottom of the stem and working up and out (stagger 0.12s, ease `cubic-bezier(.3,0,.2,1)`, small 1.08 overshoot). At the same time, the out-of-focus circles **morph into rounded squares**. This is a true shape interpolation (an SVG `<animate>` on `d`, with identical path structures).
3. **~1.1s:** the picked dot lifts out of its slot (from −2.2 / +3 px, scale 0.6 → 1.08 → 1) and settles.
4. **1.5–2.7s:** hold.
5. **2.7–3.2s:** everything relaxes back to circles and dims.

Use it for loaders, the hero and splash screens, at 48px and up. **Reduced motion:** show the still mark instead. For example:
```html
<picture>
  <source srcset="/brand/focus-mark-green.svg" media="(prefers-reduced-motion: reduce)">
  <img src="/brand/focus-mark-animated-green.svg" alt="Focus" width="64" height="64">
</picture>
```
When the mark is inlined, call `svg.pauseAnimations(); svg.setCurrentTime(1.6)` under reduced motion to freeze it on the focused state.

## Wiring
```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/png/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/png/app-icon-180.png">
```
The web manifest uses `png/app-icon-192.png` and `png/app-icon-512.png`.

## Don't
- Don't swap circles and frames, add strokes, or recolour individual dots.
- Don't move the picked dot back into its slot, or remove the empty slot.
- Don't rotate or mirror the mark: the F must read upright.
- Don't put the mark in an extra ring or tile of your own design.
- Don't use the full framed mark below 32px.
