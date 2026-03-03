$agentDataRoot = Join-Path (Get-Location).Path ".agent"
$targetDirs = @("browser_data", "browser_test")

foreach ($dir in $targetDirs) {
    $path = Join-Path $agentDataRoot $dir
    if (Test-Path $path) {
        Get-ChildItem -Path $path -Filter "Preferences" -Recurse | ForEach-Object {
            Write-Host "Updating Preferences at: $($_.FullName)"
            $content = Get-Content $_.FullName -Raw
            # 異常終了ステータスの正常化
            $content = $content -replace '"exit_type":"Crashed"','"exit_type":"Normal"' `
                                -replace '"exit_type":"SessionCrashed"','"exit_type":"Normal"' `
                                -replace '"exited_cleanly":false','"exited_cleanly":true' `
                                -replace '"restore_on_startup":\d+','"restore_on_startup":0'
            Set-Content -Path $_.FullName -Value $content -Encoding UTF8
        }
    }
}
