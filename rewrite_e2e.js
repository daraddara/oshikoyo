const fs = require('fs');
const testFile = 'tests/e2e/auto_layout.test.js';
let content = fs.readFileSync(testFile, 'utf8');

content = content.replace(/await page\.waitForSelector\('#btnSettings', \{ state: 'visible' \}\);[\s\S]*?await page\.waitForSelector\('#settingsModal', \{ state: 'hidden' \}\);/g,
`const autoLayoutBtn = page.locator('.layout-mode-btn');
        await expect(autoLayoutBtn).toBeVisible();`);

content = content.replace(/window\.appSettings\.autoLayoutMode = true;/g, "window.appSettings.layoutMode = 'smart';");
content = content.replace(/window\.appSettings\.autoLayoutMode = false;/g, "window.appSettings.layoutMode = 'top';");

content = content.replace(/await page\.click\('#btnSettings'\);[\s\S]*?await autoLayoutCheckbox\.uncheck\(\);[\s\S]*?await page\.click\('#btnSave'\);/g,
`const autoLayoutBtn = page.locator('.layout-mode-btn');
        await expect(autoLayoutBtn).toBeVisible();
        await autoLayoutBtn.click();
        await page.locator('.layout-item[data-layout="top"]').click();`);

fs.writeFileSync(testFile, content);
