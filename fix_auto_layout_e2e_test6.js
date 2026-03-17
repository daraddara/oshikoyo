const fs = require('fs');

const testFile = 'tests/e2e/auto_layout.test.js';
let content = fs.readFileSync(testFile, 'utf8');

// The issue is likely that the first regex I used left some lines behind.
// I will just read the file, split into an array of lines, modify what I need and rewrite it.
const lines = content.split('\n');
const newLines = [];

let inBeforeEachSettingsBlock = false;
let inTest3SettingsBlock = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes("window.appSettings.autoLayoutMode = true;")) {
        newLines.push(line.replace("autoLayoutMode = true", "layoutMode = 'smart'"));
        continue;
    }

    if (line.includes("window.appSettings.autoLayoutMode = false;")) {
        newLines.push(line.replace("autoLayoutMode = false", "layoutMode = 'top'"));
        continue;
    }

    if (line.includes("await page.waitForSelector('#btnSettings', { state: 'visible' });")) {
        // start of beforeEach settings block
        if (i < 20) {
            inBeforeEachSettingsBlock = true;
            newLines.push("        const autoLayoutBtn = page.locator('.layout-mode-btn');");
            newLines.push("        await expect(autoLayoutBtn).toBeVisible();");
            continue;
        }
    }

    if (inBeforeEachSettingsBlock) {
        if (line.includes("await page.waitForSelector('#settingsModal', { state: 'hidden' });")) {
            inBeforeEachSettingsBlock = false;
        }
        continue;
    }

    if (line.includes("await page.click('#btnSettings');") && i > 120) {
        // Start of Test 3 block
        inTest3SettingsBlock = true;
        newLines.push("        const autoLayoutBtn = page.locator('.layout-mode-btn');");
        newLines.push("        await expect(autoLayoutBtn).toBeVisible();");
        newLines.push("        await autoLayoutBtn.click();");
        newLines.push("        await page.locator('.layout-item[data-layout=\"top\"]').click();");
        continue;
    }

    if (inTest3SettingsBlock) {
        if (line.includes("await page.click('#btnSave');")) {
            inTest3SettingsBlock = false;
        }
        continue;
    }

    newLines.push(line);
}

fs.writeFileSync(testFile, newLines.join('\n'));
console.log('Fixed auto layout test via lines replacement');
