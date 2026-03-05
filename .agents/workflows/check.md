---
description: Playwright E2EテストによるUIおよび機能検証の自動実行
---
# 手順
1. **事前準備（環境のクリーンアップ）**:
   - 既存のサーバープロセスや不要なブラウザプロセスが残っている場合は終了してください。
   - Linux: `npx kill-port 8081` および `pkill -9 chrome || true`
   - Windows: `taskkill /F /IM node.exe /T` および `taskkill /F /IM chrome.exe /T`

2. **E2Eテストの実行**:
   - Playwright による E2E テストを実行します。このテスト内で開発サーバーの起動からUI検証まで自動で行われます。
   - `npm run e2e`

3. **検証と記録**:
   - E2E テストが成功したか確認してください。
   - テスト結果のスクリーンショットは `tests/e2e/screenshots/` または `playwright-report/` に保存されます。

4. **報告書の作成 (Walkthrough)**:
   - 実行結果（パスしたテスト、キャプチャされた画像など）を元に報告書を作成してください。
   - 画像埋め込みのパス指定はOS環境に応じて変えてください。詳細は `.agents/rules/documentation-maintenance.md` を参照してください。