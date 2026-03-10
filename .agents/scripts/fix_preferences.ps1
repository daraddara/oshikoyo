# 既存のテスト用ブラウザプロセスの確実な終了 (関連プロファイルのみを対象)
Write-Host "Cleaning up lingering Chrome processes for this profile..."
Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" | Where-Object { $_.CommandLine -match "antigravity-browser-profile" -or $_.CommandLine -match "browser_data" } | Invoke-CimMethod -MethodName Terminate | Out-Null
Start-Sleep -Seconds 1


# サーバー用ポート(8081)の確実な解放
$portConn = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
if ($portConn) {
    Write-Host "Freeing server port 8081..."
    Stop-Process -Id $portConn.OwningProcess -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2



$agentDataRoot = Join-Path (Get-Location).Path ".agents"
# ユーザー名に依存しない形でシステムレベルのプロファイルパスを定義
$systemProfileRoot = Join-Path $env:USERPROFILE ".gemini\antigravity-browser-profile"

$targetDirs = @(
    (Join-Path $agentDataRoot "browser_data"),
    (Join-Path $agentDataRoot "browser_test"),
    $systemProfileRoot
)

$utf8NoBOM = New-Object System.Text.UTF8Encoding($false)

foreach ($path in $targetDirs) {
    if (Test-Path $path) {
        Write-Host "Cleaning up profile locks in: $path"
        Remove-Item -Path (Join-Path $path "SingletonLock") -Force -ErrorAction SilentlyContinue
        Remove-Item -Path (Join-Path $path "SingletonCookie") -Force -ErrorAction SilentlyContinue
        Remove-Item -Path (Join-Path $path "SingletonSocket") -Force -ErrorAction SilentlyContinue

        # クラッシュによる拡張機能SWやセッションの破損を癒やす
        $defaultDir = Join-Path $path "Default"
        if (Test-Path $defaultDir) {
            Write-Host "Cleaning up corrupted extension caches in: $defaultDir"
            Remove-Item -Path (Join-Path $defaultDir "Service Worker") -Recurse -Force -ErrorAction SilentlyContinue
            Remove-Item -Path (Join-Path $defaultDir "Sessions") -Recurse -Force -ErrorAction SilentlyContinue
            Remove-Item -Path (Join-Path $defaultDir "Session Storage") -Recurse -Force -ErrorAction SilentlyContinue
        }

        # Preferencesファイルを再帰的に検索
        Get-ChildItem -Path $path -Filter "Preferences" -Recurse -Force | ForEach-Object {
            Write-Host "Updating Preferences at: $($_.FullName)"
            $fullPath = $_.FullName
            try {
                $content = [System.IO.File]::ReadAllText($fullPath)
                
                # 異常終了ステータスの正常化 (より安全な置換)
                $newContent = $content.Replace('"exit_type":"Crashed"', '"exit_type":"Normal"')
                $newContent = $newContent.Replace('"exit_type":"SessionCrashed"', '"exit_type":"Normal"')
                $newContent = $newContent.Replace('"exited_cleanly":false', '"exited_cleanly":true')
                
                # restore_on_startup は正規表現でも安全な範囲に限定
                $newContent = $newContent -replace '"restore_on_startup":\d+', '"restore_on_startup":0'
                
                # BOMなしUTF-8で保存
                [System.IO.File]::WriteAllText($fullPath, $newContent, $utf8NoBOM)
            }
            catch {
                Write-Host "Failed to process $($fullPath): $($_.Exception.Message)"
            }
        }
    }
}
