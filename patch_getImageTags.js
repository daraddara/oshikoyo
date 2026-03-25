const fs = require('fs');
let content = fs.readFileSync('src/script.js', 'utf8');

// Insert EMPTY_TAGS constant
content = content.replace(
    '// --- Tag Logic ---\nfunction getImageTags(imgId) {',
    '// --- Tag Logic ---\nconst EMPTY_TAGS = Object.freeze([]);\n\nfunction getImageTags(imgId) {'
);

// Update getImageTags function
content = content.replace(
    '    return meta[imgId]?.tags ? [...meta[imgId].tags] : [];',
    '    return meta[imgId]?.tags || EMPTY_TAGS;'
);

fs.writeFileSync('src/script.js', content);
