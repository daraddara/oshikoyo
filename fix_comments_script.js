const fs = require('fs');

const jsFile = 'src/script.js';
let content = fs.readFileSync(jsFile, 'utf8');

// The original content had old comments that were just duplicated by my regex replacement.
// Let's clean it up.
content = content.replace(
    /\/\/ 'left' layout: image is on left, drag right increases width\n                \/\/ 'right' layout: image is on right, drag left increases width\n                \/\/ 'left' layout: image is on left, drag right \(positive deltaX\) increases width\n                \/\/ 'right' layout: image is on right, drag left \(negative deltaX\) increases width/g,
    "// 'left' layout: image is on left, drag right (positive deltaX) increases width\n                // 'right' layout: image is on right, drag left (negative deltaX) increases width"
);

content = content.replace(
    /\/\/ 'top' layout: image is top, drag down increases height\n                \/\/ 'bottom' layout: image is bottom, drag up increases height\n                \/\/ 'top' layout: image is top, drag down \(positive deltaY\) increases height\n                \/\/ 'bottom' layout: image is bottom, drag up \(negative deltaY\) increases height/g,
    "// 'top' layout: image is top, drag down (positive deltaY) increases height\n                // 'bottom' layout: image is bottom, drag up (negative deltaY) increases height"
);

// We also still have autoLayoutMode logic in default settings we didn't fully remove in previous script.
content = content.replace(/\s*autoLayoutMode:\s*true,\s*\/\/\s*Automatically optimize layout based on image aspect ratio/g, '');
content = content.replace(/\s*if\s*\(typeof\s*data\.autoLayoutMode\s*===\s*'boolean'\)\s*validated\.autoLayoutMode\s*=\s*data\.autoLayoutMode;/g, '');

fs.writeFileSync(jsFile, content);
