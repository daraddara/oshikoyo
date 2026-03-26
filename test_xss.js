const fs = require('fs');

const html = `
    async function refreshPwaDebugPanel() {
        const panel = document.getElementById('pwa-debug-panel');
        if (!panel) return;
        const info = await collectPwaDebugInfo();
        const rows = [
            ['ブラウザ', info.browser],
            ['表示モード', info.displayMode],
            ['インストール確認', info.installVerify],
            ['SW状態', info.sw],
            ['SWスコープ', info.swScope || '-'],
            ['キャッシュ', info.caches || '-'],
            ['Manifestアイコン', info.manifestIcons || '-'],
            ['share_target', info.shareTarget || '-'],
            ['インストールプロンプト', info.installPrompt],
            ['UA', info.ua],
        ];
        panel.querySelector('#pwa-debug-body').innerHTML = rows.map(([k, v]) =>
            \`<tr><td style="color:#aaa;padding:2px 8px 2px 0;white-space:nowrap;vertical-align:top">\${escapeHTML(k)}</td><td style="word-break:break-all">\${escapeHTML(String(v))}</td></tr>\`
        ).join('');
        const installBtn = panel.querySelector('#pwa-debug-install');
        if (installBtn) {
            installBtn.style.display = _debugInstallPromptCaptured ? 'block' : 'none';
        }
    }
`;

console.log(html);
