const fs = require('fs');

const cssFile = 'src/style.css';
let content = fs.readFileSync(cssFile, 'utf8');

// I seem to have reverted the style.css change as well. Let's reapply the layout-dropdown CSS.

const layoutMenuStyles = `
/* Layout Mode Controls */
.layout-mode-wrapper {
    position: relative;
    display: flex;
}

.layout-dropdown {
    position: fixed;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    padding: 6px;
    min-width: 120px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 2px;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-10px);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.layout-dropdown.is-open {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
}

.layout-item {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.85rem;
    color: var(--text-primary);
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 8px;
}

.layout-item:hover {
    background: rgba(0, 0, 0, 0.05);
}

.layout-item.is-active {
    background: var(--accent-color);
    color: white;
}

.layout-mode-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-primary);
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: all 0.2s;
    opacity: 0.7;
}

.layout-mode-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    opacity: 1;
}

.layout-mode-btn.active {
    background: var(--accent-color);
    color: white;
    opacity: 1;
}

@media (prefers-color-scheme: dark) {
    .layout-dropdown {
        background: rgba(30, 41, 59, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .layout-item:hover {
        background: rgba(255, 255, 255, 0.1);
    }
}
`;

if (!content.includes('layout-dropdown')) {
    content = content.replace(/\.interval-dropdown\s*\{/, layoutMenuStyles + '\n.interval-dropdown {');

    // Remove drag handles and dropzones
    content = content.replace(/\/\* Drag Handle \*\/[\s\S]*?(?=\/\* 画面全体のドロップゾーン \*\/)/g, '');
    content = content.replace(/\/\* 画面全体のドロップゾーン \*\/[\s\S]*?(?=\/\* Quick Media Mode Controls \*\/)/g, '');
    content = content.replace(/,\s*\.media-drag-handle\s*\{\s*background:\s*rgba\(30,\s*41,\s*59,\s*0\.4\);\s*border:\s*1px\s*solid\s*rgba\(255,\s*255,\s*255,\s*0\.1\);\s*\}/g, ' {\n        background: rgba(30, 41, 59, 0.4);\n        border: 1px solid rgba(255, 255, 255, 0.1);\n    }');
    content = content.replace(/\.quick-media-controls,\s*\.media-drag-handle\s*\{/g, '.quick-media-controls {');
    content = content.replace(/\s*\.layout-dropzone,\s*\.media-drag-handle/g, '');
    content = content.replace(/\.layout-splitter,\s*\{/g, '.layout-splitter {'); // Just in case my previous fix left a dangling comma

    fs.writeFileSync(cssFile, content);
}
console.log('Re-applied style.css changes');
