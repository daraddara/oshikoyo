#!/usr/bin/env bash
# PWA開発サーバー起動スクリプト
# 使い方: ./scripts/pwa-serve.sh

set -e

cd "$(dirname "$0")/.."

echo "=== ポート8081を解放 ==="
npx kill-port 8081 2>/dev/null && echo "解放しました" || echo "使用中のプロセスなし"

echo ""
echo "=== サーバー起動 (npm run serve) ==="
npm run serve > /tmp/serve.log 2>&1 &
SERVE_PID=$!

# 起動確認（最大10秒ポーリング）
for i in $(seq 1 50); do
  sleep 0.2
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/ 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ]; then
    echo "起動確認 OK (HTTP $HTTP_CODE, PID: $SERVE_PID)"
    break
  fi
  if [ $i -eq 50 ]; then
    echo "ERROR: サーバーが起動しませんでした"
    cat /tmp/serve.log
    exit 1
  fi
done

echo ""
echo "=== トンネル起動 (npm run tunnel) ==="
npm run tunnel > /tmp/tunnel.log 2>&1 &
TUNNEL_PID=$!

# URL抽出（最大20秒待機）
TUNNEL_URL=""
for i in $(seq 1 100); do
  sleep 0.2
  TUNNEL_URL=$(grep -o 'https://[^ ]*\.trycloudflare\.com' /tmp/tunnel.log 2>/dev/null | head -1 || true)
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
done

echo ""
echo "=========================================="
if [ -n "$TUNNEL_URL" ]; then
  echo "外部公開URL: $TUNNEL_URL"
else
  echo "WARNING: トンネルURLを取得できませんでした"
  echo "  /tmp/tunnel.log を確認してください"
fi
echo "=========================================="
echo "serve PID : $SERVE_PID"
echo "tunnel PID: $TUNNEL_PID"
echo ""
echo "終了するには: kill $SERVE_PID $TUNNEL_PID"
echo "  または  : npx kill-port 8081 && kill $TUNNEL_PID"
