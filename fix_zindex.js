const fs = require('fs');

const cssFile = 'src/style.css';
let content = fs.readFileSync(cssFile, 'utf8');

// Update z-index of layout dropdown so it appears above immersive elements
content = content.replace(/\.layout-dropdown \{\n([\s\S]*?)z-index: 10000;/, ".layout-dropdown {\n$1z-index: 20000;");

// Update z-index of quick media controls wrapper itself if needed
// Actually, immersive mode uses z-index: 10 on media-area.
// layout-dropdown has z-index: 10000. It should be fine.

// The issue says "イマーシブモード時、画像レイアウトのボタンが、ポップアップは出ますが、押しても何も反応せず機能していません"
// "In immersive mode, the image layout button shows a popup, but pressing it does nothing and it doesn't function."

// Let's check the script.js logic for when a layout item is clicked.
