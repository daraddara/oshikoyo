const fs = require('fs');
let content = fs.readFileSync('src/script.js', 'utf8');
content = content.replace("updateLayoutMenuUI();\n        applyImmersiveState();\n        applyImmersiveState();", "updateLayoutMenuUI();\n        applyImmersiveState();");
content = content.replace(/function updateView\(\) \{[\s\S]*?renderCalendarWrapper\(\);/, "function updateView() {\n    updateLayoutMenuUI();\n    applyImmersiveState();\n    renderCalendarWrapper();");
fs.writeFileSync('src/script.js', content);
