const fs = require('fs');
let content = fs.readFileSync('src/script.js', 'utf8');

content = content.replace(
    '[...imageTagFilter].some(t => getImageTags(item.id).includes(t))',
    'getImageTags(item.id).some(t => imageTagFilter.has(t))'
);

fs.writeFileSync('src/script.js', content);
