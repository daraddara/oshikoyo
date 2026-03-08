# プロジェクト構成 (Project Structure)

本プロジェクトのディレクトリ構成と各ファイルの役割について説明します。

## ディレクトリマップ

```text
.
├── .agents/                # エージェント用ルール・スクリプト
│   └── rules/
│       └── directory-structure.md  # 構造維持ルール
├── benchmarks/             # ベンチマーク関連
├── docs/                   # プロジェクトドキュメント
│   ├── AGENTS.md
│   ├── DEVELOPMENT.md
│   ├── ISSUES.md
│   ├── PROJECT_STRUCTURE.md (this file)
│   └── TESTING.md
├── src/                    # アプリケーションソース
│   ├── assets/             # 静的アセット
│   ├── script.js           # メインロジック
│   └── style.css           # スタイルシート
├── tests/                  # テスト関連
│   ├── e2e/                # E2Eテスト
│   └── scripts/            # テスト実行用スクリプト
├── index.html              # エントリーポイント
├── manifest.json           # PWAマニフェスト
├── package.json            # パッケージ設定
├── playwright.config.js    # Playwright設定
├── README.md               # プロジェクト概要
└── sw.js                   # Service Worker
```

## 各ディレクトリの役割

### ルート (Root)
アプリケーションのエントリーポイント（`index.html`）と、PWAとして動作するためにルート配置が必要なファイル（`sw.js`, `manifest.json`）を配置しています。また、プロジェクト全体の構成を定義する設定ファイルもここに含まれます。

### src/
アプリケーションの実効コードを格納します。`index.html` から参照される `script.js` や `style.css`、および画像などの `assets/` が含まれます。

### docs/
開発環境の構築手順、既知の課題、プロジェクト構造の解説など、開発者向けの情報を集約しています。

### benchmarks/
IndexedDBの動作検証やパフォーマンス計測に使用するツールを格納しています。

### tests/
ユニットテスト（Vitest）やE2Eテスト（Playwright）のコード、およびテスト実行に必要なユーティリティを含みます。
