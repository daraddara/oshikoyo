---
description: 
---

---
description: Playwright E2EテストによるUIおよび機能検証の自動実行
---
# 手順
1. **事前準備（環境のクリーンアップ）**:
   - 既存のサーバープロセスや不要なブラウザプロセスが残っている場合は終了してください。
   - `taskkill /F /IM node.exe /T -ErrorAction SilentlyContinue`
   - `taskkill /F /IM chrome.exe /T -ErrorAction SilentlyContinue`

2. **E2Eテストの実行**:
   - Playwright による E2E テストを実行します。このテスト内で開発サーバーの起動からUI検証まで自動で行われます。
   - `npm run e2e`

3. **検証と記録**:
   - E2E テストが成功したか確認してください。
   - テスト結果のスクリーンショットは `tests/e2e/screenshots/` または `playwright-report/` に保存されます。

4. **報告書の作成 (Walkthrough)**:
   - 実行結果（パスしたテスト、キャプチャされた画像など）を元に報告書を作成してください。
   - 画像埋め込みには **プロジェクトルートからの相対パス** を使用してください。