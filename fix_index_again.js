const fs = require('fs');

const htmlFile = 'index.html';
let content = fs.readFileSync(htmlFile, 'utf8');

// I seem to have reverted the index.html change. I will re-apply it.

// Remove auto layout checkbox
const regex = /<div class="setting-group">\s*<label>レイアウト設定<\/label>\s*<div class="checkbox-group">\s*<label title="画像の形状に合わせて最適な配置を自動選択します">\s*<input type="checkbox" id="checkAutoLayout" checked>\s*レイアウトおまかせモード\s*<\/label>\s*<\/div>\s*<\/div>/g;
content = content.replace(regex, '');

// Remove layout-dropzone divs
content = content.replace(/<div class="layout-dropzone[^>]*><\/div>\s*/g, '');

// Remove mediaDragHandle div and its svg
const dragHandleRegex = /<div class="media-drag-handle" id="mediaDragHandle" draggable="true" title="ドラッグして移動">\s*<svg[^>]*>[\s\S]*?<\/svg>\s*<\/div>\s*/g;
content = content.replace(dragHandleRegex, '');

// Add layout menu
const layoutMenuHTML = `
                            <div class="layout-mode-wrapper layout-mode-control">
                                <button type="button" class="layout-mode-btn active" title="レイアウトの設定">
                                    <svg class="icon-layout-smart" style="display: block;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>
                                    <svg class="icon-layout-top" style="display: none;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="7" rx="2" ry="2"/><rect x="3" y="14" width="18" height="7" rx="2" ry="2" opacity="0.3"/></svg>
                                    <svg class="icon-layout-bottom" style="display: none;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="14" width="18" height="7" rx="2" ry="2"/><rect x="3" y="3" width="18" height="7" rx="2" ry="2" opacity="0.3"/></svg>
                                    <svg class="icon-layout-left" style="display: none;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18" rx="2" ry="2"/><rect x="14" y="3" width="7" height="18" rx="2" ry="2" opacity="0.3"/></svg>
                                    <svg class="icon-layout-right" style="display: none;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="3" width="7" height="18" rx="2" ry="2"/><rect x="3" y="3" width="7" height="18" rx="2" ry="2" opacity="0.3"/></svg>
                                </button>
                                <div class="layout-dropdown">
                                    <div class="menu-section-title">レイアウト</div>
                                    <div class="layout-item is-active" data-layout="smart">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>
                                        <span>自動 (Smart)</span>
                                    </div>
                                    <div class="layout-item" data-layout="top">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="7" rx="2" ry="2"/><rect x="3" y="14" width="18" height="7" rx="2" ry="2" opacity="0.3"/></svg>
                                        <span>上配置</span>
                                    </div>
                                    <div class="layout-item" data-layout="bottom">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="14" width="18" height="7" rx="2" ry="2"/><rect x="3" y="3" width="18" height="7" rx="2" ry="2" opacity="0.3"/></svg>
                                        <span>下配置</span>
                                    </div>
                                    <div class="layout-item" data-layout="left">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18" rx="2" ry="2"/><rect x="14" y="3" width="7" height="18" rx="2" ry="2" opacity="0.3"/></svg>
                                        <span>左配置</span>
                                    </div>
                                    <div class="layout-item" data-layout="right">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="3" width="7" height="18" rx="2" ry="2"/><rect x="3" y="3" width="7" height="18" rx="2" ry="2" opacity="0.3"/></svg>
                                        <span>右配置</span>
                                    </div>
                                </div>
                            </div>
`;

if (!content.includes('layout-mode-wrapper')) {
    content = content.replace('<div class="media-mode-wrapper display-mode-control">', layoutMenuHTML + '\n                            <div class="media-mode-wrapper display-mode-control">');
}

fs.writeFileSync(htmlFile, content);
console.log('Re-applied index.html changes');
