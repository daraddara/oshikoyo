const fs = require('fs');
const jsFile = 'src/script.js';
let content = fs.readFileSync(jsFile, 'utf8');

// Also make sure to check if layout menu is open
content = content.replace(/!document\.querySelector\('\.quick-media-controls:hover'\)/, "!document.querySelector('.quick-media-controls:hover') && !document.querySelector('.layout-dropdown.is-open') && !document.querySelector('.interval-dropdown.is-open')");

fs.writeFileSync(jsFile, content);
console.log('Fixed auto hide logic to keep UI visible if menus are open');
