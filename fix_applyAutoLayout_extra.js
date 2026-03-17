const fs = require('fs');

const jsFile = 'src/script.js';
let content = fs.readFileSync(jsFile, 'utf8');

content = content.replace(
    /\s*if \(!appSettings\.autoLayoutMode\) return;\n/,
    "\n"
);

fs.writeFileSync(jsFile, content);
console.log('Fixed extra appSettings.autoLayoutMode check');
