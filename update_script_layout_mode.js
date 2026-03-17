const fs = require('fs');

const jsFile = 'src/script.js';
let content = fs.readFileSync(jsFile, 'utf8');

// 1. Add layoutMode to DEFAULT_SETTINGS
content = content.replace(
    /mediaIntervalPreset:\s*'1m',\s*\/\/\s*'10s',\s*'30s',\s*'1m',\s*'10m',\s*'1h',\s*'0:00',\s*'4:00',\s*'startup'\n\s*lastActiveInterval:\s*'1m',/,
    "mediaIntervalPreset: '1m', // '10s', '30s', '1m', '10m', '1h', '0:00', '4:00', 'startup'\n    lastActiveInterval: '1m',\n    layoutMode: 'smart', // 'smart', 'top', 'bottom', 'left', 'right'"
);

// 2. Add validation for layoutMode
content = content.replace(
    /if\s*\(typeof\s*data\.mediaIntervalPreset\s*===\s*'string'\)\s*validated\.mediaIntervalPreset\s*=\s*data\.mediaIntervalPreset;/,
    "if (typeof data.mediaIntervalPreset === 'string') validated.mediaIntervalPreset = data.mediaIntervalPreset;\n    if (typeof data.layoutMode === 'string') validated.layoutMode = data.layoutMode;"
);

// 3. Update applyAutoLayout to only run if mode is smart
content = content.replace(
    /function\s*applyAutoLayout\(img\)\s*\{/,
    "function applyAutoLayout(img) {\n    if (appSettings.layoutMode !== 'smart') return;"
);

// 4. Update initSettings to sync Layout menu UI and add event listeners
const layoutInitLogic = `
function updateLayoutMenuUI() {
    const layoutModeBtn = document.querySelector('.layout-mode-btn');
    if (!layoutModeBtn) return;

    // Update main icon based on setting
    const icons = {
        smart: layoutModeBtn.querySelector('.icon-layout-smart'),
        top: layoutModeBtn.querySelector('.icon-layout-top'),
        bottom: layoutModeBtn.querySelector('.icon-layout-bottom'),
        left: layoutModeBtn.querySelector('.icon-layout-left'),
        right: layoutModeBtn.querySelector('.icon-layout-right'),
    };

    Object.values(icons).forEach(icon => { if (icon) icon.style.display = 'none'; });
    if (icons[appSettings.layoutMode]) {
        icons[appSettings.layoutMode].style.display = 'block';
    }

    // Update active state in dropdown
    const layoutItems = document.querySelectorAll('.layout-item');
    layoutItems.forEach(item => {
        if (item.getAttribute('data-layout') === appSettings.layoutMode) {
            item.classList.add('is-active');
        } else {
            item.classList.remove('is-active');
        }
    });
}

function setupLayoutMenu() {
    const layoutModeBtn = document.querySelector('.layout-mode-btn');
    const layoutDropdown = document.querySelector('.layout-dropdown');

    if (layoutDropdown) {
        document.body.appendChild(layoutDropdown);
    }

    if (layoutModeBtn) {
        layoutModeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (layoutDropdown) {
                const isOpen = layoutDropdown.classList.contains('is-open');
                if (!isOpen) {
                    const btnRect = e.currentTarget.getBoundingClientRect();
                    layoutDropdown.style.top = \`\${btnRect.bottom + 8}px\`;
                    layoutDropdown.style.left = 'auto';
                    layoutDropdown.style.right = \`\${window.innerWidth - btnRect.right}px\`;
                    layoutDropdown.classList.add('is-open');
                } else {
                    layoutDropdown.classList.remove('is-open');
                }
            }
        });
    }

    const layoutItems = document.querySelectorAll('.layout-item');
    layoutItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const mode = e.currentTarget.getAttribute('data-layout');
            appSettings.layoutMode = mode;

            if (mode !== 'smart') {
                appSettings.mediaPosition = mode;
                if (mode === 'top' || mode === 'bottom') {
                    appSettings.layoutDirection = 'row';
                } else {
                    appSettings.layoutDirection = 'column';
                }
            } else {
                // If smart, trigger re-evaluation if we have a current image
                const mainImg = document.querySelector('.media-main-img');
                if (mainImg) {
                    applyAutoLayout(mainImg);
                }
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
            updateLayoutMenuUI();
            updateLayoutToggleUI();
            updateView();

            if (layoutDropdown) {
                layoutDropdown.classList.remove('is-open');
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (layoutDropdown && layoutDropdown.classList.contains('is-open') && !e.target.closest('.layout-mode-control') && !e.target.closest('.layout-dropdown')) {
            layoutDropdown.classList.remove('is-open');
        }
    });
}
`;

content = content.replace(
    /function\s*updateLayoutToggleUI\(\)\s*\{/,
    layoutInitLogic + '\nfunction updateLayoutToggleUI() {'
);

content = content.replace(
    /updateQuickMediaButtons\(\);/,
    "updateQuickMediaButtons();\n        setupLayoutMenu();\n        updateLayoutMenuUI();"
);

// 5. Update splitter logic for right and bottom
content = content.replace(
    /newSize\s*=\s*pos\s*===\s*'left'\s*\?\s*startSize\s*\+\s*deltaX\s*:\s*startSize\s*-\s*deltaX;/,
    "newSize = pos === 'left' ? startSize + deltaX : startSize - deltaX;"
);

content = content.replace(
    /newSize\s*=\s*pos\s*===\s*'top'\s*\?\s*startSize\s*\+\s*deltaY\s*:\s*startSize\s*-\s*deltaY;/,
    "newSize = pos === 'top' ? startSize + deltaY : startSize - deltaY;"
);

fs.writeFileSync(jsFile, content);
console.log('Updated script.js with layoutMode logic and fixed splitter resizing');
