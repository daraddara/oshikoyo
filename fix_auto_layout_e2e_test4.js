const fs = require('fs');

const testFile = 'tests/e2e/auto_layout.test.js';
let content = fs.readFileSync(testFile, 'utf8');

// The original file is clean now. Let's do carefully.

// 1. In beforeEach:
// Remove opening settings modal and checking auto layout checkbox.
content = content.replace(/await page\.waitForSelector\('#btnSettings', \{ state: 'visible' \}\);\n\s*await page\.click\('#btnSettings'\);\n\n\s*const autoLayoutCheckbox = page\.locator\('#checkAutoLayout'\);\n\s*await expect\(autoLayoutCheckbox\)\.toBeVisible\(\);\n\s*if \(!\(await autoLayoutCheckbox\.isChecked\(\)\)\) \{\n\s*await autoLayoutCheckbox\.check\(\);\n\s*\}\n\s*await page\.click\('#btnSave'\);/,
"const autoLayoutBtn = page.locator('.layout-mode-btn');\n        await expect(autoLayoutBtn).toBeVisible();"
);

// 2. Replace window.appSettings.autoLayoutMode = true with window.appSettings.layoutMode = 'smart'
content = content.replace(/window\.appSettings\.autoLayoutMode = true;/g, "window.appSettings.layoutMode = 'smart';");

// 3. In the third test "should respect manual settings when auto-layout is OFF":
// Replace window.appSettings.autoLayoutMode = false with window.appSettings.layoutMode = 'top'
content = content.replace(/window\.appSettings\.autoLayoutMode = false;/g, "window.appSettings.layoutMode = 'top';");

// Replace turning off auto layout checkbox with using the new pill menu
content = content.replace(
    /await page\.click\('#btnSettings'\);\n\s*const autoLayoutCheckbox = page\.locator\('#checkAutoLayout'\);\n\s*await expect\(autoLayoutCheckbox\)\.toBeVisible\(\);\n\s*await autoLayoutCheckbox\.uncheck\(\);\n\s*await page\.click\('#btnSave'\);/,
    "const autoLayoutBtn = page.locator('.layout-mode-btn');\n        await expect(autoLayoutBtn).toBeVisible();\n        await autoLayoutBtn.click();\n        await page.locator('.layout-item[data-layout=\"top\"]').click();"
);

fs.writeFileSync(testFile, content);
console.log('Fixed e2e tests correctly');
