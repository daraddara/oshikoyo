---
description: スマホ実機(PWA)での動作確認のためにサーバーとcloudflaredトンネルを起動する
---

# 手順
1. **事前準備**: 
   - `npm run serve` と `npm run tunnel` が実行可能な状態であることを確認します。
   - `cloudflared` がインストールされていることを確認します。

2. **サーバー起動**:
// turbo
   `npm run serve > /tmp/serve.log 2>&1 &` 等を使用してバックグラウンドで起動し、ポート `8081` がリッスンしていることを確認します。起動に失敗する場合は、`.agents/rules/execute-tests.md` に従い、既存のプロセスをクリーンアップしてから再起動します。

3. **Cloudflared トンネル起動**:
// turbo
   `npm run tunnel > /tmp/tunnel.log 2>&1 &` を実行し、`/tmp/tunnel.log` から `https://*.trycloudflare.com` の形式のURLを抽出します。

4. **URLの提示**:
   - 抽出した公開URLをユーザーに提示し、「スマートフォン等でこのURLにアクセスして動作確認を行ってください」と案内します。

5. **テスト完了後のクリーンアップ**:
   - ユーザーから動作確認完了の指示（例：`/finish`）があった場合、または検証が終了した際は、バックグラウンドの `serve` プロセスおよび `cloudflared` プロセスを安全に終了させます。
