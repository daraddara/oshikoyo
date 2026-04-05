# 開発ガイドライン (Development Guidelines)

## 🌐 公開URL

| 環境 | URL |
|---|---|
| 本番 (Cloudflare Pages) | https://oshikoyo.pages.dev/ |

> [!NOTE]
> リポジトリは private ですが、Cloudflare Pages によって静的ファイルが公開されています。
> `main` ブランチへのマージが自動でデプロイに反映されます。

---

## 🛠️ 技術スタック
- **Core**: HTML5, CSS3 (Vanilla CSS), JavaScript (Vanilla JS / ES6+)
- **Storage**: IndexedDB (画像データ用), localStorage (設定・状態用)
- **Networking**: Service Worker (PWA対応 / オフライン動作)
- **Libraries**: 
  - [Vitest](https://vitest.dev/): ロジックテスト
  - [Playwright](https://playwright.dev/): E2Eテスト
  - [Gzip (CompressionStream)](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream): バックアップ圧縮

## 🚀 環境構築と実行
1. **依存関係のインストール**:
   ```bash
   npm install
   ```
2. **開発サーバーの起動**:
   ```bash
   npm run serve
   ```
   (http://localhost:8081 で起動します)

## 🧪 テストの実行
- **ユニットテスト**: `npm test`
- **E2Eテスト**: `npm run e2e`
- **E2Eテスト (UIモード)**: `npm run e2e:ui`

## 📖 開発ルール
詳細な開発ルールやGit運用方針については、`.agents/rules/` 内の各ドキュメントを参照してください。これらはエージェントおよび開発者が遵守すべき「唯一の真実 (SSOT)」です。

- [oshikoyo-core.md](../.agents/rules/oshikoyo-core.md): 基本開発規約
- [git-branching-policy.md](../.agents/rules/git-branching-policy.md): Git運用
- [testing-policy.md](../.agents/rules/testing-policy.md): テスト方針
- [COMMON_FUNCTIONS.md](./COMMON_FUNCTIONS.md): 主要関数リファレンス

## 🔧 デバッグチップス
- **ストレージの確認**: Chrome DevTools の `Application` タブから IndexedDB (`OshikoyoDB`) および LocalStorage を確認できます。
- **Service Worker**: `Application` -> `Service Workers` から登録解除や更新の強制が可能です。
