# Jack-o-Gen

Browser-only parametric pumpkin (jack-o'-lantern) generator that exports STL for 3D printing.
Target: Bambu Lab A1 (256 mm bed), 0.4 mm nozzle, PLA. Public launch ~10/24. Deploy: Cloudflare Pages (`npm run build` → `dist`, NODE_VERSION=22).

## Commands
- `npm run dev` — Vite dev server (http://localhost:5173)
- `npm test` — vitest (geometry + manifold checks for every preset/stem/mode, URL round-trip)
- `npm run build` — `tsc -b && vite build`

## Stack
React 18 + TS + Vite, three / @react-three/fiber / drei (preview), manifold-3d WASM (all booleans, always-manifold output) in a Web Worker via comlink, zustand.

## Layout
- `src/model/params.ts` — single source of truth for parameters (`NUM_DEFS`: URL key, group, range, `advanced` = under "More", `hidden` = no UI, only presets/URL).
- `src/geometry/` — `body.ts` (r(θ,φ) surface, 45° overhang clamp, flat base), `stem.ts`, `face/` (2D presets, layout: pointed-arch tops, island bridges, 2D checks), `build.ts` (CSG: lantern = constant-wall hollow + LED hole + flat Ø50 bridge at the top center + 20° (70° overhang) cone only under the flat top), `checks.ts` (language-neutral codes), `stl.ts`.
- `src/worker/` — geometry worker (preview res vs export res).
- `src/state/` — store, URL sync (only non-default values), preset cards, stem styles (`stems.ts`).
- `src/i18n/` — `en.ts` / `ja.ts`; English is default, toggle in top bar. Every UI string goes through `useT()`.
- `src/ui/` — 3 tabs: Shape (body / ribs / stem picker) · Face (2D editor) · Print (mode, wall/LED, download, checks).

## Conventions
- Coordinates: mm, z-up; front = −y. Face coords are mm at reference diameter 120, scaled by D/120.
- Code comments are in Japanese; keep new UI strings in both dictionaries.
- Keep the visible control count low; prefer presets/pattern pickers over new sliders.
- Stem bend ≲ 0.4 in presets (stronger bends make the tip underside overhang).
- Lantern mode is LED-only (PLA softens ~60 °C) — keep the warning in UI and pre-download dialog.
- Work on a branch, then merge into `main`.

## Not in MVP (deferred)
Lidded storage mode, 3MF multicolor, freehand face drawing, LED glow preview, gallery.
