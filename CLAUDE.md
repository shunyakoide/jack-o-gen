# Jack-o-Gen

Browser-only parametric pumpkin (jack-o'-lantern) generator that exports STL for 3D printing.
Target: any FDM printer, 0.4 mm nozzle, PLA (fit tolerances were calibrated on a Bambu Lab A1). No bed-size check: users have different printers, so size is never warned about (typed/URL diameter is only capped at 1 m so a crafted link can't hang the browser). Public launch ~10/24. Deploy: GitHub Pages at https://jack-o-gen.shunyakoide.com (the `pages` job in `.github/workflows/ci.yml` publishes main after tests pass; DNS only on Cloudflare; `PRODUCTION_SITE_URL` in `vite.config.ts`; `.env*` is gitignored, so never put secrets in committed config).

## Commands
- `npm run dev` — Vite dev server (http://localhost:5173)
- `npm test` — vitest (geometry + manifold checks for every preset/stem/mode, URL round-trip). Heavy suites are split into separate files so they run in parallel.
- `npm run test:fast` — same but skips `*.slow.test.ts` (export resolution, 20 random shapes)
- `npm run build` — `tsc -b && vite build`

## Stack
React 18 + TS + Vite, three / @react-three/fiber / drei (preview), manifold-3d WASM (all booleans, always-manifold output) in a Web Worker via comlink, zustand.

## Layout
- `src/model/params.ts` — single source of truth for parameters (`NUM_DEFS`: URL key, group, range, `advanced` = under "More", `hidden` = no UI, only presets/URL).
- `src/geometry/` — `body.ts` (r(θ,φ) surface, 45° overhang clamp, flat base), `stem.ts`, `face/` (2D presets, `draw.ts` freehand pen → normalized shapes/lines, layout: pointed-arch tops, island bridges, 2D checks + red problem regions), `build.ts` (CSG: lantern = constant-wall hollow + LED hole + flat Ø50 bridge at the top center + 20° (70° overhang) cone only under the flat top; lid mode splits off the top), `checks.ts` (language-neutral codes), `stl.ts`.
- `src/worker/` — geometry worker (preview res vs export res).
- `src/state/` — store, URL sync (only non-default values, `v=1`; last design autosaved to localStorage and restored when opened without a link), preset cards, stem styles (`stems.ts`).
- `src/i18n/` — `en.ts` / `ja.ts`; English is default, toggle in top bar. Every UI string goes through `useT()`.
- `src/ui/` — 3 tabs: Shape (body / ribs / stem picker) · Face (2D editor) · Print (mode, wall/LED, download, checks).

## Conventions
- Coordinates: mm, z-up; front = −y. Face coords are mm at reference diameter 120, scaled by D/120.
- Code comments are in Japanese; keep new UI strings in both dictionaries.
- Keep the visible control count low; prefer presets/pattern pickers over new sliders.
- Stem bend ≲ 0.4 in presets (stronger bends make the tip underside overhang).
- Lantern mode is LED-only (PLA softens ~60 °C) — keep the warning in UI and pre-download dialog.
- Lid mode (`opening: 'lid'`): no floor LED hole; a zigzag 45° carved lid around the stem (`LID` / `lidCut` in `build.ts`) whose flat underside is the enlarged flat inner ceiling. Tests require it to lift straight off, not drop in, stay within 0.5 mm sideways, and not fit when rotated half a tooth. Keep the star off the body grid's angles (degenerate seam triangles otherwise).
- Shared links are permanent: never rename/remove a URL key (`q`) or preset id, and don't change a default without bumping `URL_VERSION` in `url.ts` and filling the old defaults back in for older links (`tests/url.test.ts` pins the v1 defaults).
- Work on a branch, then merge into `main`.

## Not planned
Gallery (dropped).
