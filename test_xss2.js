const fs = require('fs');

// We have XSS here:
// panel.querySelector('#pwa-debug-body').innerHTML = rows.map(([k, v]) =>
//    `<tr><td style="color:#aaa;padding:2px 8px 2px 0;white-space:nowrap;vertical-align:top">${k}</td><td style="word-break:break-all">${v}</td></tr>`
// ).join('');
//
// `v` comes from info.browser, info.displayMode, info.sw, info.swScope, info.caches, info.manifestIcons, info.shareTarget, info.installPrompt, info.ua.
// Most of them come from browser environment directly, so it's a DOM-based XSS vulnerability.
