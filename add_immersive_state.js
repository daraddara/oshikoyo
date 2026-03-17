const fs = require('fs');
const jsFile = 'src/script.js';
let content = fs.readFileSync(jsFile, 'utf8');

// Add to DEFAULT_SETTINGS
content = content.replace(
    /layoutMode:\s*'smart',\s*\/\/\s*'smart',\s*'top',\s*'bottom',\s*'left',\s*'right'/,
    "layoutMode: 'smart', // 'smart', 'top', 'bottom', 'left', 'right'\n    immersiveMode: false,"
);

// Add to validateImportedSettings
content = content.replace(
    /if\s*\(typeof\s*data\.layoutMode\s*===\s*'string'\)\s*validated\.layoutMode\s*=\s*data\.layoutMode;/,
    "if (typeof data.layoutMode === 'string') validated.layoutMode = data.layoutMode;\n    if (typeof data.immersiveMode === 'boolean') validated.immersiveMode = data.immersiveMode;"
);

// Add logic to updateLayoutMenuUI
content = content.replace(
    /const\s*layoutItems\s*=\s*document\.querySelectorAll\('\.layout-item'\);\n\s*layoutItems\.forEach\(item => \{/,
    `const layoutItems = document.querySelectorAll('.layout-item:not(.toggle-immersive)');
    layoutItems.forEach(item => {`
);

content = content.replace(
    /function updateLayoutMenuUI\(\) \{[\s\S]*?\}\n\nfunction setupLayoutMenu\(\)/,
    (match) => {
        let result = match.replace(/}\n\nfunction setupLayoutMenu\(\)/,
            `    const toggleImmersive = document.getElementById('btnToggleImmersive');
    if (toggleImmersive) {
        if (appSettings.immersiveMode) {
            toggleImmersive.classList.add('is-active');
        } else {
            toggleImmersive.classList.remove('is-active');
        }
    }
}

function setupLayoutMenu()`);
        return result;
    }
);

fs.writeFileSync(jsFile, content);
console.log('Added immersive state to script.js');
