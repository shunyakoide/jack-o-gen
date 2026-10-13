# Jack-o-Gen brand

2026-10-14 採用。丸い三つのふくらみ、右へ曲がるヘタ、三角の目、片側が上がる口と一本の歯。
選定した画像の形状をそのまま使用し、オレンジ・暗い紫・アイボリーで統一する。

## Assets

| ファイル | 用途 |
| --- | --- |
| `public/brand/pumpkin.png` | 透過マーク、768 × 514 px |
| `public/brand/pumpkin-small.png` | ヘッダー用の軽量版、96 × 64 px |
| `public/favicon-16.png` / `favicon-32.png` / `favicon-48.png` | 透過ファビコン |
| `public/favicon.ico` | 16 / 32 / 48 px を収録 |
| `public/apple-touch-icon.png` | 暗い紫の背景、180 × 180 px |
| `public/og-card.png` | 中央配置の OG カード、1200 × 630 px |

サイトの横組みロゴは、マークと Outfit 600 の `Jack-o-Gen` を組み合わせる。
文字色は `#f4ebe1`、背景は `#140f19` 系。マーク単体には背景も文字も含めない。
OG カードのコピーは `Make your own Halloween.`。

開発サーバー起動中は `/design/brand/preview.html` で一式を確認できる（本番サイトには含まれない）。

## Source and export

- `pumpkin-source.png`: ユーザーが選んだ Image Gen の透過 PNG。形や表情の再描画なし。
- `og-source.png`: 上記マークと採用済みの中央配置案を参照して、組み込み Image Gen で生成したカード。
- マークの余白のみを `(left: 140, top: 311, width: 974, height: 652)` で切り出し、768 px 幅へ縮小。
- ファビコンは切り出したマークを各サイズの幅 − 2 px に縮小し、透過正方形の中央へ配置。
- Apple アイコンは同じマークを幅 144 px に縮小し、180 px の `#140f19` 背景の中央へ配置。
- OG カードは縦横比を保って 1200 × 630 px に収める。切り取り・引き伸ばしなし。
- 書き出しは Sharp によるサイズ調整と PNG/ICO 変換。通常のサイトビルドでは再生成しない。

OG 生成指示の要点: 選定済みパンプキンの形と片側が上がった笑顔を保持。暗い紫の背景、上段中央に
オレンジのパンプキン、下にアイボリーの丸みのある `Jack-o-Gen` と小さなコピー。
余白を広く取り、装飾を追加しない。画像は組み込み Image Gen で生成、CLI/API は使用していない。

## Metadata references

- [Open Graph protocol](https://ogp.me/)
- [Vite HTML transform hook](https://vite.dev/guide/api-plugin.html#transformindexhtml)
- [Cloudflare Pages build environment](https://developers.cloudflare.com/pages/configuration/build-configuration/)

公開 URL は未定。`SITE_URL`（または Cloudflare Pages の `CF_PAGES_URL`）をビルド時に使用する。
