---
description: 
---

---
description: プロファイル隔離、起動前清掃、Chromeバブル抑止、および即時強制終了によるUIセルフチェック
---
# 手順
1. **メインエージェントによる事前準備（サーバー起動と疎通確認）**:
   - **プロセスの強制終了**: 修繕スクリプト（`fix_preferences.ps1`）に含まれる処理により、テストプロファイルを使用する `chrome.exe` とポート8081を占有するプロセスのみを安全に終了します。

   - **隔離プロファイルのバブル抑止（個人環境への影響ゼロ）**: 
     エージェント専用プロファイル内の終了ステータスのみを正常化します。
     ```powershell
     powershell -ExecutionPolicy Bypass -File .agent/scripts/fix_preferences.ps1
     ```
   
   - **ポート解放と起動**: 8081番ポートを確実に解放してから、サーバーをバックグラウンドで起動してください。
     `Get-Process -Id (Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force`
     `npx serve . -p 8081`

   - **MUST DO: 起動完了の待機（疎通確認）**: 
     サーバー起動後、対象URL(`http://localhost:8081`)が正常応答を返すようになるまで、`curl`等でポーリングして待機しなければなりません。これを怠ると、次のステップでブラウザが接続エラーを起こします。

2. **ブラウザエージェントへの指示（UI検証）**:
   - メインエージェントは、疎通確認が完了した後にブラウザツール（サブエージェント）を呼び出してください。その際、プロンプトに必ず以下を含めてください：
     「すでに起動済みのサーバーを利用すること。自身でサーバーを再起動・新規起動しようとしないこと」
   - **プロファイルの分離とバブル抑止**: ブラウザを起動する際は、必ず以下の引数を付与してください。
     `--user-data-dir=".agent/browser_data" --disable-session-crashed-bubble --disable-infobars --restore-last-session=false`
   - **最重要：URLの指定**: **必ず `http://localhost:8081/index.html` をフルパスで開いてください。**
   - ページを開いた直後に `localStorage.clear()` を実行し、リロードして検証を開始してください。

3. **ビジュアル確認**:
   - ダークモード/ライトモードの視認性、レスポンシブ表示を確認してください。

4. **機能動作確認**:
   - 設定パネルの保存反映、カレンダーの月移動などが正しく動作するか確認してください。

5. **推し設定確認**:
   - 推しの追加/削除、カラー反映をチェックしてください。

6. **課題照合**:
   - `ISSUES.md` に記載されている未完了事項を確認してください。

7. **検証と記録**:
   - `screenshots/` フォルダに Issue ID を含めて保存してください（例: `A-09-result.png`）。

8. **報告書の作成 (Walkthrough)**:
   - 画像埋め込みには **プロジェクトルートからの相対パス** を使用してください。

9. **クリーンアップ**:
   - バックグラウンドで残るローカルサーバーなどをピンポイントで終了してください。
   - `Get-Process -Id (Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force`