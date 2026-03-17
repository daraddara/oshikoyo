const fs = require('fs');
const htmlFile = 'index.html';
let content = fs.readFileSync(htmlFile, 'utf8');

const immersiveHTML = `
                                    <div class="layout-divider"></div>
                                    <div class="layout-item toggle-immersive" id="btnToggleImmersive">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                                        <span>没入モード (Immersive)</span>
                                        <div class="toggle-switch"></div>
                                    </div>
                                </div>
`;

content = content.replace(/<\/div>\n\s*<\/div>\n\s*<div class="media-mode-wrapper display-mode-control">/, immersiveHTML + '                            <div class="media-mode-wrapper display-mode-control">');

fs.writeFileSync(htmlFile, content);
console.log('Added Immersive mode toggle to HTML');
