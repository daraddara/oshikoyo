const fs = require('fs');

const jsFile = 'src/script.js';
let content = fs.readFileSync(jsFile, 'utf8');

// Add toggleImmersiveMode function and logic to setupLayoutMenu
const toggleLogic = `
function toggleImmersiveMode() {
    appSettings.immersiveMode = !appSettings.immersiveMode;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));

    applyImmersiveState();
    updateLayoutMenuUI();
}

let controlsTimer = null;
function applyImmersiveState() {
    const calendarSection = document.querySelector('.calendar-section');
    if (appSettings.immersiveMode) {
        document.body.classList.add('is-immersive');

        // Auto-hide controls
        document.body.classList.add('controls-visible');
        setupImmersiveControlsTimer();

        document.addEventListener('mousemove', handleImmersiveMouseMove);

        // Create dismiss zone if not exists
        if (!document.querySelector('.overlay-dismiss-zone')) {
            const dismissZone = document.createElement('div');
            dismissZone.className = 'overlay-dismiss-zone';
            dismissZone.addEventListener('click', () => {
                document.body.classList.remove('show-overlay');
            });
            document.body.appendChild(dismissZone);
        }

    } else {
        document.body.classList.remove('is-immersive');
        document.body.classList.remove('show-overlay');
        document.body.classList.remove('controls-visible');
        document.removeEventListener('mousemove', handleImmersiveMouseMove);
        if (controlsTimer) clearTimeout(controlsTimer);

        // Reset calendar section styles
        if (calendarSection) {
            calendarSection.style.top = '';
            calendarSection.style.bottom = '';
            calendarSection.style.left = '';
            calendarSection.style.right = '';
            calendarSection.style.transform = '';
        }
    }

    // Save original direction for full overlay restoring
    const calendarWrapper = document.getElementById('calendarWrapper');
    if (calendarWrapper) {
        calendarWrapper.style.setProperty('--original-direction', appSettings.layoutDirection);
    }
}

function setupImmersiveControlsTimer() {
    if (controlsTimer) clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => {
        if (!document.body.classList.contains('show-overlay') && !document.querySelector('.quick-media-controls:hover')) {
            document.body.classList.remove('controls-visible');
        }
    }, 3000);
}

function handleImmersiveMouseMove() {
    document.body.classList.add('controls-visible');
    setupImmersiveControlsTimer();
}
`;

// Insert the logic before initSettings
content = content.replace(/function initSettings\(\) \{/, toggleLogic + '\nfunction initSettings() {');

// Bind to button inside setupLayoutMenu
content = content.replace(
    /document\.addEventListener\('click',\s*\(e\)\s*=>\s*\{/,
    `const toggleImmersive = document.getElementById('btnToggleImmersive');
    if (toggleImmersive) {
        toggleImmersive.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleImmersiveMode();
            if (layoutDropdown) {
                layoutDropdown.classList.remove('is-open');
            }
        });
    }

    document.addEventListener('click', (e) => {`
);

// Call applyImmersiveState in updateView or initSettings
content = content.replace(
    /updateLayoutMenuUI\(\);/,
    "updateLayoutMenuUI();\n        applyImmersiveState();"
);

fs.writeFileSync(jsFile, content);
console.log('Added Immersive logic to script.js');
