const fs = require('fs');

const jsFile = 'src/script.js';
let content = fs.readFileSync(jsFile, 'utf8');

// Wait, the user said the button popup opens but clicking it does nothing.
// That is because in setupLayoutMenu, the layoutItems click handler checks `mode !== 'smart'` and then updates `appSettings.mediaPosition`.
// Wait, the Immersive mode item has class `layout-item toggle-immersive`, so `document.querySelectorAll('.layout-item')` in `setupLayoutMenu` will attach the standard layout click handler to it!
// Then the standard handler does `appSettings.layoutMode = null` or something if it tries to read `data-layout` from it! (since it doesn't have `data-layout`).

content = content.replace(
    /const layoutItems = document\.querySelectorAll\('\.layout-item'\);\n\s*layoutItems\.forEach\(item => \{/,
    `const layoutItems = document.querySelectorAll('.layout-item:not(.toggle-immersive)');
    layoutItems.forEach(item => {`
);

fs.writeFileSync(jsFile, content);
console.log('Fixed immersive toggle click interference');
