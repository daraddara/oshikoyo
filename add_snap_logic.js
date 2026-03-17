const fs = require('fs');

const jsFile = 'src/script.js';
let content = fs.readFileSync(jsFile, 'utf8');

const snapLogic = `
// --- Mini Calendar Drag & Snap Logic ---
function setupMiniCalendarInteractions() {
    const calendarSection = document.querySelector('.calendar-section');
    if (!calendarSection) return;

    let isDragging = false;
    let startX, startY, initialX, initialY;

    // Handle drag
    calendarSection.addEventListener('mousedown', (e) => {
        if (!appSettings.immersiveMode || document.body.classList.contains('show-overlay') || window.innerWidth <= 768) return;

        // Don't drag if clicking controls inside the calendar (if any are visible)
        if (e.target.closest('button') || e.target.tagName.toLowerCase() === 'input') return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const rect = calendarSection.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;

        calendarSection.classList.add('is-dragging');
        e.preventDefault(); // Prevent text selection
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        calendarSection.style.left = \`\${initialX + dx}px\`;
        calendarSection.style.top = \`\${initialY + dy}px\`;
        calendarSection.style.bottom = 'auto'; // Disable bottom/right to rely on top/left
        calendarSection.style.right = 'auto';
    });

    document.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        calendarSection.classList.remove('is-dragging');

        // Check if it was a click (not a drag)
        const dx = Math.abs(e.clientX - startX);
        const dy = Math.abs(e.clientY - startY);

        if (dx < 5 && dy < 5) {
            // It was a click, trigger overlay
            document.body.classList.add('show-overlay');
            return;
        }

        // Snap logic
        const rect = calendarSection.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        const margin = 24;

        if (centerX < winW / 2) {
            calendarSection.style.left = \`\${margin}px\`;
            calendarSection.style.right = 'auto';
        } else {
            calendarSection.style.right = \`\${margin}px\`;
            calendarSection.style.left = 'auto';
        }

        if (centerY < winH / 2) {
            calendarSection.style.top = \`\${margin}px\`;
            calendarSection.style.bottom = 'auto';
        } else {
            calendarSection.style.bottom = \`\${margin}px\`;
            calendarSection.style.top = 'auto';
        }
    });

    // Also handle click if no drag occurred (for mobile or quick clicks)
    calendarSection.addEventListener('click', (e) => {
        if (appSettings.immersiveMode && !document.body.classList.contains('show-overlay') && !isDragging) {
            // Extra safety to avoid triggering if it was just dragged
            document.body.classList.add('show-overlay');
        }
    });
}
`;

content = content.replace(/function updateToggleMonthsUI\(\) \{/, snapLogic + '\nfunction updateToggleMonthsUI() {');

// Call it in init
content = content.replace(/setupLayoutMenu\(\);/, "setupLayoutMenu();\n    setupMiniCalendarInteractions();");

fs.writeFileSync(jsFile, content);
console.log('Added snap logic to script.js');
