const fs = require('fs');

const cssFile = 'src/style.css';
let content = fs.readFileSync(cssFile, 'utf8');

const immersiveCSS = `

/* --- Immersive Mode --- */
body.is-immersive .main-layout {
    flex-direction: row !important; /* Force reset */
}

body.is-immersive .media-area {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw !important;
    height: 100vh !important;
    max-width: 100vw !important;
    z-index: 10;
    padding: 0;
    margin: 0;
}

body.is-immersive .media-container {
    height: 100vh !important;
    border-radius: 0;
}

body.is-immersive .media-backdrop {
    filter: blur(30px) brightness(0.8);
    transform: scale(1.1); /* Prevent blurred edges from leaking empty space */
}

body.is-immersive .media-main-img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain; /* Main image takes up as much space as possible without cropping */
}

/* Hide normal layout splitter */
body.is-immersive .layout-splitter {
    display: none !important;
}

/* Auto-hide controls in immersive mode */
body.is-immersive .quick-media-controls {
    opacity: 0;
    transition: opacity 0.5s ease;
}

body.is-immersive.controls-visible .quick-media-controls,
body.is-immersive .quick-media-controls:hover,
body.is-immersive .quick-media-controls:focus-within {
    opacity: 1;
}

/* Toggle Switch Styling */
.toggle-switch {
    width: 32px;
    height: 18px;
    background: rgba(0,0,0,0.2);
    border-radius: 99px;
    position: relative;
    margin-left: auto;
    transition: background 0.3s;
}

.toggle-switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: white;
    border-radius: 50%;
    transition: transform 0.3s;
}

.is-active .toggle-switch {
    background: var(--accent-color);
}

.is-active .toggle-switch::after {
    transform: translateX(14px);
}

/* Keep dropdown active background neutral for the toggle item itself */
.layout-item.toggle-immersive.is-active {
    background: transparent;
    color: var(--text-primary);
}

.layout-item.toggle-immersive:hover {
    background: rgba(0, 0, 0, 0.05);
}

@media (prefers-color-scheme: dark) {
    .layout-item.toggle-immersive.is-active {
        color: var(--text-primary);
    }
    .layout-item.toggle-immersive:hover {
        background: rgba(255, 255, 255, 0.1);
    }
    .toggle-switch {
        background: rgba(255,255,255,0.2);
    }
}
`;

content += immersiveCSS;

fs.writeFileSync(cssFile, content);
console.log('Added immersive mode CSS to style.css');
