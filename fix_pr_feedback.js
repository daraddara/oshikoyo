const fs = require('fs');
const cssFile = 'src/style.css';
let content = fs.readFileSync(cssFile, 'utf8');

// 1. Refine Mini-Calendar (Oshikoyo-Mini)
// Hide Headers:
content = content.replace(/body\.is-immersive \.month-header \{[\s\S]*?\}/, `body.is-immersive .month-header { display: none; }`);

// Hide navigation buttons is already done via body.is-immersive .controls { display: none; }

// Reduce Size & Glassmorphism:
content = content.replace(/body\.is-immersive \.calendar-section \{[\s\S]*?cursor: pointer;\n\}/,
`body.is-immersive .calendar-section {
    position: fixed;
    z-index: 20;
    bottom: 24px;
    right: 24px;
    width: 220px; /* Reduced by ~30% from 300px */
    max-width: 90vw;
    background: rgba(255, 255, 255, 0.4); /* Increased transparency */
    backdrop-filter: blur(12px); /* Slightly lower blur to let image through more */
    -webkit-backdrop-filter: blur(12px);
    border-radius: 12px; /* Slightly smaller radius */
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    padding: 8px; /* Tighter padding */
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
}`);

// Dark mode glassmorphism
content = content.replace(/@media \(prefers-color-scheme: dark\) \{\n\s*body\.is-immersive \.calendar-section \{\n\s*background: rgba\(30, 41, 59, 0\.7\);\n\s*\}\n\}/,
`@media (prefers-color-scheme: dark) {
    body.is-immersive .calendar-section {
        background: rgba(30, 41, 59, 0.4);
    }
}`);

// Reduce font size and padding for dates
content = content.replace(/body\.is-immersive \.calendar-day \{\n\s*min-height: 36px;\n\s*padding: 4px;\n\}/,
`body.is-immersive .calendar-day {
    min-height: 24px;
    padding: 2px;
}`);

content = content.replace(/body\.is-immersive \.date-number \{\n\s*font-size: 0\.9rem;\n\}/,
`body.is-immersive .date-number {
    font-size: 0.7rem;
}`);

// Hide Event Text & dots:
content = content.replace(/body\.is-immersive \.event-item \{\n\s*font-size: 0; \/\* Hide text \*\/\n\s*width: 6px;\n\s*height: 6px;\n\s*padding: 0;\n\s*border-radius: 50%;\n\s*margin: 0;\n\s*opacity: 0\.8;\n\}/,
`body.is-immersive .event-item {
    font-size: 0; /* Hide text */
    width: 4px; /* 3-4px as requested */
    height: 4px;
    padding: 0;
    border-radius: 50%;
    margin: 0 1px;
    opacity: 0.9;
}`);


// 2. Full-Screen Backdrop:
content = content.replace(/body\.is-immersive \.media-backdrop \{\n\s*filter: blur\(30px\) brightness\(0\.8\);\n\s*transform: scale\(1\.1\); \/\* Prevent blurred edges from leaking empty space \*\/\n\}/,
`body.is-immersive .media-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    object-fit: cover; /* Ensure it covers 100% seamlessly */
    filter: blur(30px) brightness(0.8);
    transform: scale(1.1); /* Prevent blurred edges from leaking empty space */
}`);


fs.writeFileSync(cssFile, content);
console.log('Applied PR styling feedback');
