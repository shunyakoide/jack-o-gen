# Jack-o-Gen

3Dプリント用のジャック・オー・ランタンを、ブラウザだけで設計して STL を書き出す Web アプリです。

- 想定プリンタ：Bambu Lab A1（造形範囲 256mm、ノズル 0.4mm、PLA）
- 技術：React + TypeScript + Vite / three・@react-three/fiber・drei / manifold-3d（WASM）/ Web Worker（comlink）/ zustand

## 開発

```sh
npm install
npm run dev        # 開発サーバー
npm test           # ジオメトリのテスト（vitest、Node 上で manifold-3d を実行）
npm run build      # 型チェック＋本番ビルド（dist/）
```

## Cloudflare Pages へのデプロイ

Cloudflare ダッシュボード → Workers & Pages → Pages → 「Git に接続」でこのリポジトリを選び、次のように設定します。

| 項目 | 値 |
|---|---|
| フレームワーク | なし（Vite） |
| ビルドコマンド | `npm run build` |
| 出力ディレクトリ | `dist` |
| 環境変数 | `NODE_VERSION=22` |

`public/_headers` で WASM の Content-Type とアセットのキャッシュを設定しています。サーバー側の処理はありません。

### ロゴ・共有カード

採用したパンプキンをヘッダーとファビコンに使用しています。画像一覧と元画像は
[`design/brand/README.md`](design/brand/README.md) にまとめています。

公開ドメインが決まったら、ビルド環境の `SITE_URL` に `https://公開ドメイン` を設定してください。
ローカルでは `.env.example` を `.env.local` にコピーして設定できます。
ビルド時に OG 画像・X カード画像の絶対 URL、`og:url`、canonical を HTML に埋め込みます。
Cloudflare Pages では未設定時に `CF_PAGES_URL` を使用します。独自ドメインを使う場合は
`SITE_URL` を明示してから再ビルドしてください。
両方未設定のローカル表示では画像を相対 URL で参照し、canonical は出力しません。
SNS 上での表示確認は公開後に行ってください。

## 構成

```
src/
  model/params.ts      パラメータの型・初期値・範囲（UI・URL・ジオメトリ共通）
  geometry/            DOM に依存しない形状生成（Worker と vitest の両方で動く）
    body.ts            外形 r(θ,φ)、45°クランプ、底面カット、経緯度グリッド、内側オフセット
    stem.ts            ヘタのスイープ
    face/presets.ts    顔パーツの 2D プリセット
    face/layout.ts     尖頭アーチ化・島のブリッジ・2D チェック
    build.ts           CSG（union／difference）、中空化、彫り込み
    checks.ts          プリント適性チェック
    stl.ts             バイナリ STL
  worker/              Web Worker（comlink）
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
- MVP では未実装：蓋付き収納、3MF 多色出力、顔の自由描画、LED 点灯時の透過プレビュー、ギャラリー。
