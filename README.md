# プロテインノート サポートサイト / LP

iOSアプリ「[プロテインノート](https://apps.apple.com/jp/app/id6748221439)」(栄養管理・筋トレ記録)の紹介ページとサポート・法的文書を配信する静的サイト。

**公開URL**: https://protein-note.theslopebook.jp/

## 構成

```
docs/                          ← GitHub Pages のルート (main ブランチ /docs 配信)
├── CNAME                      # カスタムドメイン: protein-note.theslopebook.jp
├── index.html                 # LP (3Dスクロール体験)
├── css/style.css              # 全ページ共通スタイル (下層ページが依存・互換維持)
├── css/lp.css                 # LP専用: 3Dシーン/スクラブ演出
├── js/lp.js                   # スクロールエンジン (依存ゼロ・約5KB)
├── privacy.html / privacy-en.html
├── terms.html
├── support.html / support-en.html
├── sitemap.xml / llms.txt     # SEO / AI検索(AIO)用
├── robots.txt                 # ドメイン直下で配信される(AIクローラー許可+Sitemap)
├── 2cf87dde98d34a11997337121a87b4ec.txt  # IndexNowキー(Bing即時インデックス用・削除しないこと)
├── images/                    # 最適化済み画像 (JPEG 720-750px幅・各150KB以下)
├── .nojekyll
└── protein-note-support/      # 旧URL互換のリダイレクトスタブのみ(削除しないこと)
```

## ローカルプレビュー

```bash
python3 -m http.server 5501 --directory docs
# → http://localhost:5501/ を開く
```

VSCodeのLive Server(ポート5501設定済み)でも可。`docs/` をルートに配信すること。

## デプロイ / ドメイン

`main` にpushするだけ。GitHub Pagesが `/docs` を自動配信する。

- カスタムドメイン: `protein-note.theslopebook.jp`(`docs/CNAME`)。DNS側は `theslopebook.jp` のDNSレコード設定で CNAME `protein-note` → `t-sakamoto-213.github.io`
- HTTPS: GitHubリポジトリの Settings → Pages で証明書発行後「Enforce HTTPS」をON
- 旧URL(`t-sakamoto-213.github.io/protein-note-support/...`)はGitHubの自動301+`docs/protein-note-support/`内のスタブで新URLへ誘導される。旧URLへの流入が完全になくなるまでスタブは残すこと(App Store Connect のURLは新ドメインに更新済みだが、検索結果・外部リンクからの流入が残っている)

## 法的文書の同期ルール(重要)

**正はアプリ側**。アプリリポジトリ(`Protein_Note/protein-note`)は読み取り専用で、以下を一字一句webに反映する:

| web | アプリ側の正 |
|---|---|
| privacy.html | `src/screens/PrivacyPolicyScreen.tsx` |
| terms.html | `src/screens/TermsOfServiceScreen.tsx` |
| privacy-en.html | (web独自の英訳。日本語版更新時に対応訳を反映) |

アプリ側で `PRIVACY_VERSION` / `TERMS_VERSION`(`src/constants/versions.ts`)が上がったら差分を取り込むこと。事業者名の記載有無も含めて完全一致させる。

## LPの実装メモ

- **プログレッシブエンハンスメント**: JS無効・`prefers-reduced-motion` でも全コンテンツが静的に読める。3D演出は `html.js:not(.reduced)` 配下のCSSのみで発動
- `js/lp.js` が各 `[data-scene]` にスクロール進捗 `--p`(0..1)を書き込み、動きはすべてCSS側(`transform`/`opacity`のみ)
- `css/style.css` は下層ページと共有のため、LP都合の変更は `lp.css` に書く

## SEO / AIO

- JSON-LD: `SoftwareApplication` + `FAQPage`(可視FAQと文言一致を維持すること)
- canonical / hreflang(ja・en・x-default) / OGP: 全ページ設定済み
- `llms.txt`: AI検索エンジン向けのアプリ要約。機能・料金変更時に更新
- `robots.txt`: カスタムドメイン直下で配信されるため有効(AIクローラー明示許可+Sitemap宣言)。加えて **Google Search Console への登録・sitemap送信を推奨**
- 画像更新時は `sips -s format jpeg -s formatOptions 70 --resampleWidth 720` で圧縮する

## アクセス解析

- GA4: 測定ID `G-SD50LR5JYC`(THE-SLOPEBOOK アカウント > LP専用プロパティ > ウェブストリーム「プロテインノートアプリ用 LP」/ ストリームID 15278072557)。全ページ(スタブ除く)の `</head>` 直前に gtag.js を設置
- ページ追加時は gtag スニペットとフッターの Google Analytics 使用告知も忘れずに入れること
- IndexNow: ページ追加・大幅更新時は `https://api.indexnow.org/indexnow` へ該当URLをPOSTして即時クロールを要求できる(キーは `docs/2cf87dde98d34a11997337121a87b4ec.txt`)
