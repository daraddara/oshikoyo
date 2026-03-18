# CLAUDE.md — おしこよ (Claude Code 用プロジェクトガイド)

> プロジェクトの詳細な開発規約は `docs/AGENTS.md` および `.agents/rules/` 内の各ファイルが
> **Single Source of Truth** です。このファイルは Claude Code 向けの入口ガイドです。

---

## プロジェクト概要

**おしこよ**は「推し」との日常を彩るカレンダーアプリ（PWA）です。
→ 詳細は [README.md](./README.md) を参照してください。

| 項目 | 内容 |
|---|---|
| 技術スタック | Vanilla JavaScript (ES6+), CSS3, HTML5 |
| テスト | Vitest（ユニット）/ Playwright（E2E） |
| パッケージマネージャー | npm |
| 開発サーバーポート | `8081` |

---

## 主要コマンド

```bash
npm install       # 依存関係インストール
npm test          # Vitestユニットテスト実行
npm run serve     # 開発サーバー起動 (http://localhost:8081)
npm run e2e       # Playwright E2Eテスト実行
npm run tunnel    # cloudflaredで外部公開（PWA実機確認用）
```

---

## ルールファイルの参照先

コーディング規約・Git 運用・テスト手順等の詳細は以下を参照してください。
（このファイルに重複して記載しません）

| ルール | 参照先 |
|---|---|
| 全体規約（言語・コーディング・Git・テスト・ドキュメント） | [docs/AGENTS.md](./docs/AGENTS.md) |
| JavaScript / CSS コーディング規約 | [.agents/rules/oshikoyo-core.md](./.agents/rules/oshikoyo-core.md) |
| 応答言語・ドキュメント言語指定 | [.agents/rules/communication-style.md](./.agents/rules/communication-style.md) |
| デザイン・UIスタイル制約 | [.agents/rules/design-standards.md](./.agents/rules/design-standards.md) |
| Gitブランチ・コミット・マージ戦略 | [.agents/rules/git-branching-policy.md](./.agents/rules/git-branching-policy.md) |
| テスト実施ルール・品質ガイドライン | [.agents/rules/testing-policy.md](./.agents/rules/testing-policy.md) |
| テスト記述スタイル（詳細） | [.agents/rules/testing-standards.md](./.agents/rules/testing-standards.md) |
| サーバー起動・テスト実行SOP | [.agents/rules/execute-tests.md](./.agents/rules/execute-tests.md) |
| ワークスペース衛生（一時ファイル） | [.agents/rules/workspace-hygiene.md](./.agents/rules/workspace-hygiene.md) |
| PWAトンネル運用方針 | [.agents/rules/pwa-tunnel-policy.md](./.agents/rules/pwa-tunnel-policy.md) |
| ドキュメント保守指針 | [.agents/rules/documentation-maintenance.md](./.agents/rules/documentation-maintenance.md) |
| 既知課題・機能要望 | [docs/ISSUES.md](./docs/ISSUES.md) |

---

## Claude Code 固有の注意事項

### ブランチ確認の徹底
- ファイルを1行でも編集する前に `git branch` で現在のブランチを確認してください。
- `main` / `master` ブランチ上での直接編集は禁止です。必ず作業ブランチを作成してから編集してください。

### テスト実行タイミング
- `script.js` または `*.test.js` を変更したら、自律的に `npm test` を実行してください。
- UIに変更がある場合は、ブラウザを手動操作せず `npm run e2e` を実行してください。

### サーバー起動
- 開発サーバーは `npm run serve` のみ使用してください（`python -m http.server` 等は禁止）。
- ブラウザでは `file:///` でなく必ず `http://localhost:8081` 経由でアクセスしてください。

### 一時ファイル
- 作業中に生成するログや検証ファイルは `/tmp/` に置いてください。プロジェクトルートに作成しないでください。

### コミット・マージ
- コミット前に `npm test` を実行し、全テストパスを確認してください。
- マージは常に **Squash Merge** を使用し、`main` のリニア履歴を維持してください。
