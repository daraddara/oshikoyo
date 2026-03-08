# ディレクトリ構造ルール

プロジェクトの整理状態を維持するため、新しいファイルを追加したり既存のファイルを移動したりする際は、以下の構造に従ってください。

## 構造の原則
- **ルートディレクトリ**: エントリーポイントとPWA関連ファイル、およびプロジェクト設定ファイルのみを配置します。
  - `index.html` (エントリーポイント)
  - `sw.js` (Service Worker)
  - `manifest.json` (PWA Manifest)
  - `package.json`, `playwright.config.js` 等
- **`src/`**: アプリケーションの実行に必要なソースコードとアセットを配置します。
  - `script.js`, `style.css`
  - `assets/` (画像、フォント等)
- **`docs/`**: 開発者向けのドキュメントや仕様定義ファイルを配置します。
  - `DEVELOPMENT.md`, `ISSUES.md`, `PROJECT_STRUCTURE.md` 等
- **`benchmarks/`**: パフォーマンス計測用のスクリプトやHTMLを配置します。
- **`tests/`**: テストコードを配置します。実行用スクリプトは `tests/scripts/` に配置します。

## 禁止事項
- `script.js` や `style.css` をルートディレクトリに配置しないでください。
- `DEVELOPMENT.md` や `TESTING.md` などのドキュメントをルートディレクトリに配置しないでください。
- ベンチマーク関連のファイルをルートディレクトリに放置しないでください。
