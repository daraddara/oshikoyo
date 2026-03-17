const fs = require('fs');

const testFile = 'tests/auto_layout.test.js';
let content = fs.readFileSync(testFile, 'utf8');

// Replace autoLayoutMode with layoutMode
content = content.replace(/autoLayoutMode: true/g, "layoutMode: 'smart'");
content = content.replace(/autoLayoutMode is false/g, "layoutMode is not smart");
content = content.replace(/global\.appSettings\.autoLayoutMode = false;/g, "global.appSettings.layoutMode = 'top';");

fs.writeFileSync(testFile, content);
console.log('Updated auto_layout.test.js');
