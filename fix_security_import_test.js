const fs = require('fs');

const testFile = 'tests/security_import.test.js';
let content = fs.readFileSync(testFile, 'utf8');

// Replace autoLayoutMode with layoutMode
content = content.replace(/autoLayoutMode: false/g, "layoutMode: 'top'");

fs.writeFileSync(testFile, content);
console.log('Fixed autoLayoutMode in security_import.test.js');
