const fs = require('fs');

const jsFile = 'src/script.js';
let content = fs.readFileSync(jsFile, 'utf8');

// Update splitter resizing logic
content = content.replace(
    /newSize\s*=\s*pos\s*===\s*'left'\s*\?\s*startSize\s*\+\s*deltaX\s*:\s*startSize\s*-\s*deltaX;/,
    "// 'left' layout: image is on left, drag right (positive deltaX) increases width\n                // 'right' layout: image is on right, drag left (negative deltaX) increases width\n                newSize = pos === 'left' ? startSize + deltaX : startSize - deltaX;"
);

content = content.replace(
    /newSize\s*=\s*pos\s*===\s*'top'\s*\?\s*startSize\s*\+\s*deltaY\s*:\s*startSize\s*-\s*deltaY;/,
    "// 'top' layout: image is top, drag down (positive deltaY) increases height\n                // 'bottom' layout: image is bottom, drag up (negative deltaY) increases height\n                newSize = pos === 'top' ? startSize + deltaY : startSize - deltaY;"
);

fs.writeFileSync(jsFile, content);
console.log('Fixed splitter resizing logic.');
