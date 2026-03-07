---
trigger: always_on
---

# ブラウザプロファイル隔離とバブル抑止ルール

エージェントがブラウザツールを使用してUIの検証や動的動作の確認を行う際、ホスト環境（ユーザーの個人環境）への干渉を避け、かつ「前回の終了が異常でした」といったChromeの通知バブル（InfoBar）による視覚的ノイズを完全に除去するための規定です。

## 1. 隔離プロファイルの使用
ブラウザを起動する際は、必ずプロジェクトルート配下の隔離ディレクトリを使用してください。
- **データディレクトリ**: `.agents/browser_data`
- **必須引数**: `--user-data-dir=".agents/browser_data"`
- **補足**: Antigravity ツールがシステムレベルのプロファイル（例: `%USERPROFILE%\.gemini\antigravity-browser-profile`）を優先して使用する場合があります。この場合でも、後述の修繕スクリプトによってバブルを抑制します。

## 2. 起動時のバブル抑止（引数）
以下の引数を必ず付与して、セッションクラッシュ通知やその他のバブルを抑制してください。
- `--disable-session-crashed-bubble`
- `--disable-infobars`
- `--restore-last-session=false`

## 3. Preferences ファイルの事前修繕
起動前に過去の中断で残ったテストブラウザのプロセスが存在するとポート競合（CDPエラー等）の原因になります。
これを防ぐため、**起動直前**に PowerShell スクリプトを実行し、テスト用プロファイルを使用している `chrome.exe` のみをピンポイントで終了させてから `Preferences` ファイルを正常化してください。

### 修繕の実行
プロジェクトルートで以下のコマンドを実行します。
```powershell
powershell -ExecutionPolicy Bypass -File .agents/scripts/fix_preferences.ps1
```
これにより、以下の項目が自動的に修正されます：
- `"exit_type": "Crashed" / "SessionCrashed"` → `"Normal"`
- `"exited_cleanly": false` → `true`
- `"restore_on_startup"` → `0`

## 4. プロセスの完全な終了
検証終了後は、次回テストの妨げになるのを防ぐため、関連プロセスを終了させてください。
- **注意**: `node.exe` やすべての `chrome.exe` を無差別に `taskkill` しないでください（Playwrightのドライバプロセスまで破壊され、以降の操作が不能になります）。修繕スクリプトによるテストプロファイル限定の終了処理や、ポート指定での終了を活用してください。