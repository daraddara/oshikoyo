const fs = require('fs');

const jsFile = 'src/script.js';
let content = fs.readFileSync(jsFile, 'utf8');

// I already did this in step 15 by running update_script_layout_mode.js earlier, but let me double check if `applyAutoLayout` is correct.
if (content.includes('if (appSettings.layoutMode !== \'smart\') return;')) {
    console.log('applyAutoLayout already updated.');
} else {
    content = content.replace(
        /function\s*applyAutoLayout\(img\)\s*\{\s*/,
        "function applyAutoLayout(img) {\n    if (appSettings.layoutMode !== 'smart') return;\n"
    );
    fs.writeFileSync(jsFile, content);
    console.log('applyAutoLayout updated.');
}
