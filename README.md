# Jack-o-Gen

## English

Jack-o-Gen is a browser-only jack-o'-lantern designer that exports STL files for 3D printing. Everything runs on your machine; there is no server.

**How to use.** Pick a preset, shape the body, ribs, and stem on the Shape tab, then drag the eyes, nose, and mouth on the Face tab. On the Print tab, set the wall thickness and LED opening (or switch to a lid on top, which keeps the bottom closed so it also works as a candy bowl), choose an attached or plug-in stem, check the print warnings, and download the STL (or a 3MF when the face is printed in a second color instead of cut out). The bulb button on the preview shows the pumpkin lit from inside. The Share button copies a link that restores the design. Light it with an LED tea light only, never a candle: PLA softens around 60 °C.

Tuned for a 0.4 mm nozzle and PLA. There is no size limit, so it works with any bed size.

**Development.** Requires Node 22.

```sh
npm install
npm run dev        # dev server at http://localhost:5173
npm test           # geometry and manifold tests (vitest, manifold-3d running in Node)
npm run test:fast  # skips the export-resolution and random-shape suites
npm run build      # type check and production build into dist/
```

Released under the MIT License (see `LICENSE`).

## 日本語

3Dプリント用のジャック・オー・ランタンを、ブラウザだけで設計して STL を書き出す Web アプリです。

- 想定：ノズル 0.4mm・PLA（造形範囲の制限なし。プリンターの大きさに合わせて直径を決めてください）
- 技術：React + TypeScript + Vite / three・@react-three/fiber・drei / manifold-3d（WASM）/ Web Worker（comlink）/ zustand

## 開発

```sh
npm install
npm run dev        # 開発サーバー
npm test           # ジオメトリのテスト（vitest、Node 上で manifold-3d を実行）
npm run build      # 型チェック＋本番ビルド（dist/）
```

## デプロイ

Cloudflare Workers の静的アセットとして https://jack-o-gen.shunyakoide.com に公開しています（Worker スクリプトなし、`dist/` をそのまま配信）。

```bash
npm run deploy     # ビルドして wrangler deploy
```

ドメインは `wrangler.jsonc` の `routes`、OG 用の公開 URL は `vite.config.ts` の `PRODUCTION_SITE_URL` で設定しています。フォークする場合は、`routes` を自分のドメインに変え、`.env.local` に `SITE_URL` を書いてください(`.env*` は git 管理しません)。
`public/_headers` で WASM の Content-Type とアセットのキャッシュを設定しています。

### ロゴ・共有カード

採用したパンプキンをヘッダーとファビコンに使用しています。画像一覧と元画像は
[`design/brand/README.md`](design/brand/README.md) にまとめています。

ビルド時に公開 URL(`SITE_URL`、未設定なら本番ビルドでは `PRODUCTION_SITE_URL`)から OG 画像・X カード画像の絶対 URL、`og:url`、canonical を HTML に埋め込みます。
`SITE_URL` を空にしたとき(と開発時)は画像を相対 URL で参照し、`og:url` と canonical は出力しません。
SNS 上での表示確認は公開後に行ってください。

## 構成

```
src/
  model/params.ts      パラメータの型・初期値・範囲（UI・URL・ジオメトリ共通）
  geometry/            DOM に依存しない形状生成（Worker と vitest の両方で動く）
    body.ts            外形 r(θ,φ)、45°クランプ、底面カット、経緯度グリッド、内側オフセット
    stem.ts            ヘタのスイープ
    face/presets.ts    顔パーツの 2D プリセット
    face/draw.ts       手描きの線を閉じた多角形にする
    face/layout.ts     尖頭アーチ化・島のブリッジ・2D チェック
    build.ts           CSG（union／difference）、中空化、彫り込み、蓋とリップ
    checks.ts          プリント適性チェック
    layout.ts          Print タブのベッド上の配置
    stl.ts             バイナリ STL
    threemf.ts         色分け用の 3MF
    zip.ts             STL をまとめる無圧縮 ZIP
  worker/              Web Worker（comlink）
  i18n/                英語・日本語の UI 文言
  state/               zustand ストア、URL 同期、プリセット
  preview/Viewer.tsx   3D プレビュー
  ui/                  パネル・タブ・顔エディタ
tests/                 ジオメトリのテスト
```

## 形状モデル

`r(θ,φ) = R · P(φ) · (1 − d · G(u) · W(φ))`

- `P(φ)`：上下で高さが別の超楕円体 × 卵形項 `(1 + k·cosφ)` × ヘタ周りのくぼみ
- `u = frac(N·(θ + τ·h(φ)) / 2π)`、`G(u) = 1 − |cos(π·u^skew)|^p`、`W(φ) = sin(φ)^q`
- 筋ごとの幅・深さにシード付きの個体差
- 各子午線で最大径より下を `|Δρ| ≤ Δz·tan45°` にクランプし、接地径が最大径の 35% 以上になる高さで平らにカット

## メモ

- ランタンの内天井は 45° の円錐です。上部（肩）は肉厚が厚くなりますが、スライサーのインフィルで埋まります。
- プレビューも低解像度で CSG を実行し、実際の穴を表示します。書き出し時は高解像度で作り直します。
- 蓋付き：本物のカボチャのようにヘタの周りをギザギザ（筋 1 本に山 1 つ）に切り抜き、切れ目は 45° のすり鉢です。蓋は落ちず、横にずれず、筋の向きが合う位置でだけはまります。蓋の底は平らな内天井そのものなので、サポートなしでベッドに置いて印刷できます。器はその平天井ぶんの穴が開くだけで、壁は一定の厚さのままです。
- 点灯プレビューは内側に点光源を置き、くり抜いた面と内側を発光させる表現です（壁を透ける光は再現しません）。
- ギャラリーは作りません。
