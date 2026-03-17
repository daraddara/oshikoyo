const fs = require('fs');

const testFile = 'tests/e2e/auto_layout.test.js';
let content = fs.readFileSync(testFile, 'utf8');

// The file has duplicate blocks from my very first bad replacement.
content = content.replace(/    \}\);\n        await page\.goto\('\/index\.html'\);\n        await page\.waitForLoadState\('networkidle'\);\n\n        const autoLayoutBtn = page\.locator\('\.layout-mode-btn'\);\n        await expect\(autoLayoutBtn\)\.toBeVisible\(\);\n        \/\/ default is smart, which is equivalent to autoLayoutMode = true\n    \}\);/, "    });");
content = content.replace(/    \}\);\n        await page\.goto\('\/index\.html'\);\n        await page\.waitForLoadState\('networkidle'\);\n\n        await page\.waitForSelector\('#btnSettings', \{ state: 'visible' \}\);\n        await page\.click\('#btnSettings'\);\n\n        const autoLayoutBtn = page\.locator\('\.layout-mode-btn'\);\n        await expect\(autoLayoutBtn\)\.toBeVisible\(\);\n        \n        await page\.click\('#btnSave'\);\n        await page\.waitForSelector\('#settingsModal', \{ state: 'hidden' \}\);\n    \}\);/, "    });");
content = content.replace(/    \}\);\n        await page\.goto\('\/index\.html'\);\n        await page\.waitForLoadState\('networkidle'\);\n\n        await page\.waitForSelector\('#btnSettings', \{ state: 'visible' \}\);\n        await page\.click\('#btnSettings'\);\n\n        const autoLayoutCheckbox = page\.locator\('#checkAutoLayout'\);\n        await expect\(autoLayoutCheckbox\)\.toBeVisible\(\);\n        if \(!\(await autoLayoutCheckbox\.isChecked\(\)\)\) \{\n            await autoLayoutCheckbox\.check\(\);\n        \}\n        await page\.click\('#btnSave'\);\n        await page\.waitForSelector\('#settingsModal', \{ state: 'hidden' \}\);\n    \}\);/, "    });");

// Now apply the good replacements
content = content.replace(/window\.appSettings\.autoLayoutMode = true;/g, "window.appSettings.layoutMode = 'smart';");
content = content.replace(/window\.appSettings\.autoLayoutMode = false;/g, "window.appSettings.layoutMode = 'top';");

const oldTest3Click = /await page\.click\('#btnSettings'\);[\s\S]*?await autoLayoutCheckbox\.uncheck\(\);[\s\S]*?await page\.click\('#btnSave'\);/;
const newTest3Click = "const autoLayoutBtn = page.locator('.layout-mode-btn');\n        await expect(autoLayoutBtn).toBeVisible();\n        await autoLayoutBtn.click();\n        await page.locator('.layout-item[data-layout=\"top\"]').click();";

content = content.replace(oldTest3Click, newTest3Click);

fs.writeFileSync(testFile, content);
console.log('Fixed auto layout test via regex again');
