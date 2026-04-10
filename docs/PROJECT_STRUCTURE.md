# プロジェクト構成 (Project Structure)

本プロジェクトのディレクトリ構成と各ファイルの役割について説明します。

## ディレクトリマップ

```text
.
├── .agents/                # エージェント用ルール・スクリプト
│   └── rules/              # コーディング・Git・テスト等の規約ファイル
├── assets/
│   └── logo/               # README・マニフェスト用ロゴ画像（アプリ外部）
├── benchmarks/             # IndexedDB パフォーマンス計測ツール
├── docs/                   # プロジェクトドキュメント
│   ├── AGENTS.md           # 全体開発規約（SSOT）
│   ├── COMMON_FUNCTIONS.md # 主要関数リファレンス
│   ├── DEVELOPMENT.md      # 開発環境セットアップ手順
│   ├── FEATURES.md         # 実装済み機能カタログ
│   ├── ISSUES.md           # 課題・検討事項管理
│   ├── PROJECT_STRUCTURE.md (this file)
│   ├── TESTING.md          # テスト手順・方針
│   ├── VERSIONING.md       # バージョン管理規定
│   ├── mobile-layout-constraints.md  # モバイルレイアウト制約メモ
│   ├── oshikoyo_mobile_spec.md       # モバイルUI仕様メモ
│   ├── tag-feature-plan.md           # タグ機能設計ドキュメント
│   └── tag-feature-review.md         # タグ機能レビューメモ
├── sample/                 # サンプルデータ・デモ素材
│   ├── demo/               # デモ・機能紹介用素材（アプリには組み込まれない）
│   │   └── default_portrait_demo.jpg  # 自動レイアウト紹介用縦長デモ画像
│   ├── image/              # oshi-sample.csv とセットで使うサンプル画像
│   └── oshi-sample.csv     # サンプルデータCSV
├── src/                    # アプリケーションソース
│   ├── assets/             # アプリ実行時に使用する静的アセット
│   │   ├── default_image.png           # デフォルト画像（プレースホルダー）
│   │   ├── default_landscape_demo.jpg  # 初回デフォルト登録画像
│   │   ├── icon-192.png    # PWAアイコン
│   │   └── icon-512.png    # PWAアイコン（大）
│   ├── script.js           # メインロジック（全機能を含む単一ファイル）
│   └── style.css           # スタイルシート
├── tests/                  # テスト関連
│   ├── e2e/                # Playwright E2Eテスト
│   ├── fixtures/           # テスト用画像フィクスチャ
│   └── *.test.js           # Vitest ユニットテスト
├── index.html              # エントリーポイント
├── manifest.json           # PWAマニフェスト
├── package.json            # パッケージ設定
├── playwright.config.js    # Playwright設定
├── README.md               # プロジェクト概要（ユーザー向け）
├── CLAUDE.md               # Claude Code 向け入口ガイド
└── sw.js                   # Service Worker
```

## 各ディレクトリの役割

### ルート (Root)
アプリケーションのエントリーポイント（`index.html`）と、PWAとして動作するためにルート配置が必要なファイル（`sw.js`, `manifest.json`）を配置しています。また、プロジェクト全体の構成を定義する設定ファイルもここに含まれます。

### src/
アプリケーションの実効コードを格納します。`index.html` から参照される `script.js` や `style.css`、および画像などの `assets/` が含まれます。

> **Note:** `assets/logo/` はREADMEやマニフェスト用（アプリ外部）、`src/assets/` はアプリ実行時に読み込む静的ファイルと分離されています。

### docs/
開発環境の構築手順、既知の課題、プロジェクト構造の解説など、開発者向けの情報を集約しています。コーディング規約・Git運用・テスト手順の SSOT は `.agents/rules/` にあり、`docs/AGENTS.md` から参照しています。

### benchmarks/
IndexedDBの動作検証やパフォーマンス計測に使用するツールを格納しています。

### tests/
ユニットテスト（Vitest）やE2Eテスト（Playwright）のコード、およびテスト実行に必要なユーティリティを含みます。
