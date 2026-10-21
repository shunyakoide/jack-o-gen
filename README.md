<p align="center">
  <img src="public/brand/pumpkin.png" width="120" alt="">
</p>

<h1 align="center">Jack-o-Gen</h1>

<p align="center">
  Design a jack-o'-lantern in your browser and download it as an STL for 3D printing.
</p>

<p align="center">
  <a href="https://jack-o-gen.shunyakoide.com"><strong>Open the app</strong></a> ·
  <a href="README.ja.md">日本語</a>
</p>

<img src="docs/images/shape.webp" width="800" alt="The Shape tab: presets, body and rib sliders, stem styles, and a 3D preview of a carved pumpkin">

<table>
  <tr>
    <td><img src="docs/images/face.webp" width="400" alt="The Face tab: an unwrapped face editor with draggable triangle eyes, nose and mouth"></td>
    <td><img src="docs/images/print.webp" width="400" alt="The Print tab: wall thickness, LED opening, lid and stem options, and the Download STL button"></td>
  </tr>
  <tr>
    <td align="center">Face</td>
    <td align="center">Print</td>
  </tr>
</table>

Everything runs on your machine; there is no server. Tuned for a 0.4 mm nozzle and PLA. There is no bed-size check, so pick a diameter that fits your printer (the slider goes from 60 to 240 mm, and you can type up to 1 m).

## How to use

Pick a preset, shape the body, ribs, and stem on the Shape tab, then drag the eyes, nose, and mouth on the Face tab. On the Print tab, set the wall thickness and LED opening (or switch to a lid on top, which keeps the bottom closed so it also works as a candy bowl), choose an attached or plug-in stem, check the print warnings, and download the STL (a ZIP of STLs when the stem or lid is a separate part, or a 3MF when the face is printed in a second color instead of cut out). The bulb button on the preview shows the pumpkin lit from inside. The Share button copies a link that restores the design, and your last design comes back when you reopen the site.

Light it with an LED tea light only, never a candle: PLA softens around 60 °C.

## Development

Requires Node 22.

```sh
npm install
npm run dev        # dev server at http://localhost:5173
npm test           # geometry and manifold tests (vitest, manifold-3d running in Node)
npm run test:fast  # skips the export-resolution and random-shape suites
npm run build      # type check and production build into dist/
```

Stack: React + TypeScript + Vite, three / @react-three/fiber / drei, manifold-3d (WASM) in a Web Worker (comlink), zustand.

## Deployment

The site is served from GitHub Pages at https://jack-o-gen.shunyakoide.com (`dist/` as is). Every push to `main` runs the tests, then the `pages` job in CI builds and publishes.

The public origin used for og:image, og:url and canonical is `PRODUCTION_SITE_URL` in `vite.config.ts`. For a fork, set `SITE_URL` to your own origin (`.env.local` locally; `.env*` files are not tracked). The build assumes it is served from the root (`/`), so to publish at `<user>.github.io/jack-o-gen/` without a custom domain, change Vite's `base` as well.

### Logo and share card

The pumpkin mark is used in the header and the favicons. The asset list and source images are in [`design/brand/README.md`](design/brand/README.md).

At build time the public origin (`SITE_URL`, or `PRODUCTION_SITE_URL` for production builds when unset) is used to write absolute URLs for the OG and X card images, `og:url`, and canonical into the HTML. With `SITE_URL` empty (and in development) the image is referenced by a relative URL, and `og:url` and canonical are left out.

## Layout

```
src/
  model/params.ts      parameter types, defaults and ranges (shared by UI, URL and geometry)
  geometry/            DOM-free shape generation (runs in the Worker and in vitest)
    body.ts            outer surface r(θ,φ), 45° clamp, flat base, lat-long grid, inner offset
    stem.ts            stem sweep
    face/presets.ts    2D face part presets
    face/draw.ts       turns freehand strokes into closed polygons
    face/layout.ts     pointed-arch tops, island bridges, 2D checks
    build.ts           CSG (union / difference), hollowing, carving, lid and lip
    checks.ts          printability checks
    layout.ts          bed layout on the Print tab
    manifold.ts        loads manifold-3d (WASM) and frees its objects
    rng.ts             seeded random numbers and noise
    stl.ts             binary STL
    threemf.ts         3MF for the two-color face
    zip.ts             uncompressed ZIP bundling the STLs
  worker/              Web Worker (comlink)
  i18n/                English and Japanese UI strings
  state/               zustand store, URL sync, presets, stem styles
  preview/Viewer.tsx   3D preview
  ui/                  panels, tabs, face editor
tests/                 geometry tests
```

## Shape model

`r(θ,φ) = R · P(φ) · (1 − d · G(u) · W(φ))`

- `P(φ)`: a superellipsoid with separate upper and lower heights × an egg term `(1 + k·cosφ)` × a dip around the stem
- `u = frac(N·(θ + τ·h(φ)) / 2π)`, `G(u) = 1 − |cos(π·u^skew)|^p`, `W(φ) = sin(φ)^q`
- Seeded per-rib variation in width and depth, plus an optional low-frequency wobble (zero at the poles)
- On each meridian, the part below the widest point is clamped to `|Δρ| ≤ Δz·tan45°`, and the bottom is cut flat where the contact diameter reaches the Base width ratio of the widest diameter (45% by default, 35–70%; widened if the LED opening needs more room)

## Notes

- Lantern inner ceiling: flat in the middle (bridged, up to Ø50 mm), with a 20° cone only where the inner surface would otherwise get flatter than that. Everywhere else the wall stays a constant thickness.
- The preview also runs the CSG, at low resolution, so it shows the real holes. Export rebuilds at high resolution.
- Lid on top: like a real pumpkin, the lid is cut in a zigzag around the stem (one tooth per rib) with a 45° funnel-shaped cut. The lid does not fall in, does not slide sideways, and only seats when the ribs line up. Its underside is the flat inner ceiling, so it prints flat on the bed without supports. The bowl just gets an opening the size of that flat ceiling, and the wall stays a constant thickness.
- The lit preview puts a point light inside and makes the carved faces and the interior glow (it does not simulate light passing through the wall).

## License

MIT (see [`LICENSE`](LICENSE)).
