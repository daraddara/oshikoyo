---
trigger: always_on
---

# ブラウザプロファイル隔離とバブル抑止ルール

エージェントがブラウザツールを使用してUIの検証や動的動作の確認を行う際、ホスト環境（ユーザーの個人環境）への干渉を避け、かつ「前回の終了が異常でした」といったChromeの通知バブル（InfoBar）による視覚的ノイズを完全に除去するための規定です。

## 1. 隔離プロファイルの使用
ブラウザを起動する際は、必ずプロジェクトルート配下の隔離ディレクトリを使用してください。
- **データディレクトリ**: `.agent/browser_data`
- **必須引数**: `--user-data-dir=".agent/browser_data"`

## 2. 起動時のバブル抑止（引数）
以下の引数を必ず付与して、セッションクラッシュ通知やその他のバブルを抑制してください。
- `--disable-session-crashed-bubble`
- `--disable-infobars`
- `--restore-last-session=false`

## 3. Preferences ファイルの事前修繕
ブラウザプロセスを強制終了（`taskkill` 等）した場合、次回起動時に「異常終了」としてバブルが表示されます。これを防ぐため、**起動直前**に隔離プロファイル内の `Preferences` ファイルを以下の通り書き換えてください。

### 修繕対象のステータス
PowerShell 等を用いて、以下の JSON キーと値を置換してください。
- `"exit_type": "Crashed"` → `"Normal"`
- `"exit_type": "SessionCrashed"` → `"Normal"`
- `"exited_cleanly": false` → `true`

## 4. プロセスの完全な終了
検証終了後は、関連するすべてのブラウザプロセスとサーバープロセスを、タイムアウトを待たず即座に強制終了（Terminate）してください。これにより、次回の検証時にファイルロックやポート競合が発生するのを防ぎます。
- **推奨コマンド**: `taskkill /F /IM chrome.exe /T` (Windows)
