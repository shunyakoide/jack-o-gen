<p align="center">
  <img src="public/brand/pumpkin.png" width="120" alt="">
</p>

<h1 align="center">Jack-o-Gen</h1>

<p align="center">
  ジャック・オー・ランタンをブラウザで設計して、3Dプリント用の STL を書き出す。
</p>

<p align="center">
  <a href="https://jack-o-gen.shunyakoide.com"><strong>アプリを開く</strong></a> ·
  <a href="README.md">English</a>
</p>

<img src="docs/images/shape.webp" width="800" alt="Shape タブ：プリセット、本体と筋のスライダー、ヘタの種類、くり抜いたカボチャの 3D プレビュー">

<table>
  <tr>
    <td><img src="docs/images/face.webp" width="400" alt="Face タブ：展開した顔のエディタで、三角の目・鼻・口をドラッグできる"></td>
    <td><img src="docs/images/print.webp" width="400" alt="Print タブ：壁の厚さ、LED の穴、蓋とヘタの選択、Download STL ボタン"></td>
  </tr>
  <tr>
    <td align="center">Face</td>
    <td align="center">Print</td>
  </tr>
</table>

すべて手元のブラウザで動き、サーバーはありません。ノズル 0.4mm・PLA を想定しています。造形範囲のチェックはないので、プリンターの大きさに合わせて直径を決めてください(スライダーは 60〜240 mm、数値の入力なら 1 m まで)。

## 使い方

プリセットを選び、Shape タブで本体・筋・ヘタの形を整えて、Face タブで目・鼻・口をドラッグします。Print タブでは壁の厚さと LED の穴の大きさを決め(上に蓋を付けることもできます。底が閉じるので、お菓子入れにもなります)、ヘタを一体にするか差し込み式にするかを選び、プリントの警告を確かめて STL をダウンロードします(ヘタや蓋を別パーツにすると STL をまとめた ZIP、顔をくり抜かずに別の色で印刷するときは 3MF)。プレビューの電球ボタンで、内側から灯した様子を見られます。Share ボタンはデザインを復元するリンクをコピーします。最後のデザインは、次にサイトを開いたときに戻ります。

明かりは LED キャンドルだけにして、ろうそくは使わないでください。PLA は 60 °C 前後で柔らかくなります。

## 開発

Node 22 が必要です。

```sh
npm install
npm run dev        # 開発サーバー(http://localhost:5173)
npm test           # ジオメトリのテスト(vitest、Node 上で manifold-3d を実行)
npm run test:fast  # 書き出し解像度とランダム形状のテストを飛ばす
npm run build      # 型チェック＋本番ビルド(dist/)
```

技術：React + TypeScript + Vite / three・@react-three/fiber・drei / manifold-3d(WASM)/ Web Worker(comlink)/ zustand

## デプロイ

GitHub Pages で https://jack-o-gen.shunyakoide.com に公開しています(`dist/` をそのまま配信)。main に push すると、CI のテストが通った後に `pages` ジョブがビルドして公開します。

OG 用の公開 URL は `vite.config.ts` の `PRODUCTION_SITE_URL` で設定しています。フォークする場合は `SITE_URL` を自分の公開 URL にしてください(ローカルでは `.env.local`。`.env*` は git 管理しません)。ビルドはルート(`/`)配信が前提なので、独自ドメインなしの `<user>.github.io/jack-o-gen/` に出すときは Vite の `base` も合わせて変えてください。

### ロゴ・共有カード

採用したパンプキンをヘッダーとファビコンに使用しています。画像一覧と元画像は
[`design/brand/README.md`](design/brand/README.md) にまとめています。

ビルド時に公開 URL(`SITE_URL`、未設定なら本番ビルドでは `PRODUCTION_SITE_URL`)から OG 画像・X カード画像の絶対 URL、`og:url`、canonical を HTML に埋め込みます。
`SITE_URL` を空にしたとき(と開発時)は画像を相対 URL で参照し、`og:url` と canonical は出力しません。

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
    manifold.ts        manifold-3d（WASM）の読み込みと解放
    rng.ts             シード付きの乱数・ノイズ
    stl.ts             バイナリ STL
    threemf.ts         色分け用の 3MF
    zip.ts             STL をまとめる無圧縮 ZIP
  worker/              Web Worker（comlink）
  i18n/                英語・日本語の UI 文言
  state/               zustand ストア、URL 同期、プリセット、ヘタのパターン
  preview/Viewer.tsx   3D プレビュー
  ui/                  パネル・タブ・顔エディタ
tests/                 ジオメトリのテスト
```

## 形状モデル

`r(θ,φ) = R · P(φ) · (1 − d · G(u) · W(φ))`

- `P(φ)`：上下で高さが別の超楕円体 × 卵形項 `(1 + k·cosφ)` × ヘタ周りのくぼみ
- `u = frac(N·(θ + τ·h(φ)) / 2π)`、`G(u) = 1 − |cos(π·u^skew)|^p`、`W(φ) = sin(φ)^q`
- 筋ごとの幅・深さにシード付きの個体差と、任意の低周波の歪み（極で 0）
- 各子午線で最大径より下を `|Δρ| ≤ Δz·tan45°` にクランプし、接地径が最大径の「接地径」の割合（既定 45%、35〜70%。LED の穴が収まらなければ広げる）になる高さで平らにカット

## メモ

- ランタンの内天井：中央は平ら(ブリッジで渡す。最大 Ø50 mm)で、内面がそれより寝てしまうところだけを 20° の円錐で埋めます。それ以外の壁は一定の厚さです。
- プレビューも低解像度で CSG を実行し、実際の穴を表示します。書き出し時は高解像度で作り直します。
- 蓋付き：本物のカボチャのようにヘタの周りをギザギザ（筋 1 本に山 1 つ）に切り抜き、切れ目は 45° のすり鉢です。蓋は落ちず、横にずれず、筋の向きが合う位置でだけはまります。蓋の底は平らな内天井そのものなので、サポートなしでベッドに置いて印刷できます。器はその平天井ぶんの穴が開くだけで、壁は一定の厚さのままです。
- 点灯プレビューは内側に点光源を置き、くり抜いた面と内側を発光させる表現です（壁を透ける光は再現しません）。

## ライセンス

MIT(`LICENSE` を参照)。
