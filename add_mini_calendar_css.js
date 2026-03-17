const fs = require('fs');
const cssFile = 'src/style.css';
let content = fs.readFileSync(cssFile, 'utf8');

const miniCalendarCSS = `

/* --- Mini Calendar Widget (Immersive Mode) --- */
body.is-immersive .calendar-section {
    position: fixed;
    z-index: 20;
    bottom: 24px;
    right: 24px;
    width: 300px;
    max-width: 90vw;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
    padding: 12px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
}

@media (prefers-color-scheme: dark) {
    body.is-immersive .calendar-section {
        background: rgba(30, 41, 59, 0.7);
    }
}

body.is-immersive .calendar-section:hover {
    transform: scale(1.02);
}

/* Hide controls in mini widget */
body.is-immersive .controls {
    display: none;
}

/* Simplify month header */
body.is-immersive .month-header {
    font-size: 1.1rem;
    padding: 4px 0;
    margin-bottom: 8px;
}

/* Hide extra months if monthCount > 1 but we are in mini mode */
body.is-immersive .calendar-month:not(:first-child) {
    display: none;
}

body.is-immersive .calendar-wrapper {
    flex-direction: column !important;
    gap: 0;
}

/* Mini grid cells */
body.is-immersive .calendar-day {
    min-height: 36px;
    padding: 4px;
}

body.is-immersive .date-number {
    font-size: 0.9rem;
}

/* Hide text events */
body.is-immersive .events-container {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 4px;
    justify-content: center;
    margin-top: 2px;
}

body.is-immersive .event-item {
    font-size: 0; /* Hide text */
    width: 6px;
    height: 6px;
    padding: 0;
    border-radius: 50%;
    margin: 0;
    opacity: 0.8;
}

body.is-immersive .event-item .event-icon {
    display: none;
}

/* Dragging styles */
body.is-immersive .calendar-section.is-dragging {
    cursor: grabbing;
    opacity: 0.8;
    transform: scale(1.05);
    transition: none; /* Disable transition during drag for smoothness */
}


/* --- Full Overlay (Immersive Mode Click) --- */
body.is-immersive.show-overlay .media-backdrop {
    filter: blur(50px) brightness(0.5); /* Darker blur for overlay */
    z-index: 100;
}

body.is-immersive.show-overlay .calendar-section {
    top: 50% !important;
    left: 50% !important;
    bottom: auto !important;
    right: auto !important;
    transform: translate(-50%, -50%) !important;
    width: auto;
    max-width: 95vw;
    max-height: 90vh;
    padding: 24px;
    cursor: default;
    z-index: 101;
    overflow-y: auto;
}

/* Restore normal calendar look in full overlay */
body.is-immersive.show-overlay .controls {
    display: flex;
}

body.is-immersive.show-overlay .calendar-month:not(:first-child) {
    display: block;
}

body.is-immersive.show-overlay .calendar-wrapper {
    /* Allow original row/column layout to return */
    flex-direction: var(--original-direction, row) !important;
}

body.is-immersive.show-overlay .calendar-day {
    min-height: 80px;
}

body.is-immersive.show-overlay .event-item {
    font-size: 0.75rem;
    width: auto;
    height: auto;
    padding: 2px 4px;
    border-radius: 4px;
    margin-bottom: 2px;
    opacity: 1;
}

body.is-immersive.show-overlay .event-item .event-icon {
    display: inline;
}

/* Overlay Background Click Area */
.overlay-dismiss-zone {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 99;
    cursor: zoom-out;
}

body.is-immersive.show-overlay .overlay-dismiss-zone {
    display: block;
}
`;

content += miniCalendarCSS;
fs.writeFileSync(cssFile, content);
console.log('Added mini-calendar CSS to style.css');
