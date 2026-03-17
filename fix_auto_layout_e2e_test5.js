const fs = require('fs');

const testFile = 'tests/e2e/auto_layout.test.js';
let content = fs.readFileSync(testFile, 'utf8');

// The original file:
// test.beforeEach(async ({ page }) => {
//     await page.clock.install({ time: new Date('2025-01-01T12:00:00') });
//     await page.goto('/index.html');
//     await page.waitForLoadState('networkidle');
//
//     await page.waitForSelector('#btnSettings', { state: 'visible' });
//     await page.click('#btnSettings');
//
//     const autoLayoutCheckbox = page.locator('#checkAutoLayout');
//     await expect(autoLayoutCheckbox).toBeVisible();
//     if (!(await autoLayoutCheckbox.isChecked())) {
//         await autoLayoutCheckbox.check();
//     }
//     await page.click('#btnSave');
//     await page.waitForSelector('#settingsModal', { state: 'hidden' });
// });

const oldBeforeEach = /await page\.waitForSelector\('#btnSettings', \{ state: 'visible' \}\);[\s\S]*?await page\.waitForSelector\('#settingsModal', \{ state: 'hidden' \}\);/;
const newBeforeEach = "const autoLayoutBtn = page.locator('.layout-mode-btn');\n        await expect(autoLayoutBtn).toBeVisible();\n        // default is smart, which is equivalent to autoLayoutMode = true";

content = content.replace(oldBeforeEach, newBeforeEach);

content = content.replace(/window\.appSettings\.autoLayoutMode = true;/g, "window.appSettings.layoutMode = 'smart';");
content = content.replace(/window\.appSettings\.autoLayoutMode = false;/g, "window.appSettings.layoutMode = 'top';");

const oldTest3Click = /await page\.click\('#btnSettings'\);[\s\S]*?await autoLayoutCheckbox\.uncheck\(\);[\s\S]*?await page\.click\('#btnSave'\);/;
const newTest3Click = "const autoLayoutBtn = page.locator('.layout-mode-btn');\n        await expect(autoLayoutBtn).toBeVisible();\n        await autoLayoutBtn.click();\n        await page.locator('.layout-item[data-layout=\"top\"]').click();";

content = content.replace(oldTest3Click, newTest3Click);

fs.writeFileSync(testFile, content);
console.log('Fixed e2e tests correctly again');
