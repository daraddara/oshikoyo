const fs = require('fs');

const testFile = 'tests/e2e/auto_layout.test.js';
let content = fs.readFileSync(testFile, 'utf8');

// The layout-mode-btn is not in the settings modal, it's in the quick media controls.
// The test tries to click the settings button and then look for the auto layout checkbox.
// Since we moved it, we shouldn't open the settings modal to check it anymore, but we can just test that the new button works.

const beforeEachRegex = /test\.beforeEach\(async \(\{ page \}\) => \{[\s\S]*?await page\.click\('#btnSave'\);\s*\}\);/;
const newBeforeEach = `test.beforeEach(async ({ page }) => {
        await page.clock.install({ time: new Date('2025-01-01T12:00:00') });
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Layout control is now in the main UI
        const autoLayoutBtn = page.locator('.layout-mode-btn');
        await expect(autoLayoutBtn).toBeVisible();
    });`;

content = content.replace(beforeEachRegex, newBeforeEach);

// Replace the manual uncheck in the "respect manual settings" test
content = content.replace(
    /const autoLayoutBtn = page\.locator\('\.layout-mode-btn'\);\n\s*await page\.click\('#btnSettings'\);\n\s*await expect\(autoLayoutBtn\)\.toBeVisible\(\);\n\s*await autoLayoutBtn\.click\(\); await page\.locator\('\.layout-item\[data-layout="top"\]'\)\.click\(\);\n\s*await page\.click\('#btnSave'\);/,
    "const autoLayoutBtn = page.locator('.layout-mode-btn');\n        await expect(autoLayoutBtn).toBeVisible();\n        await autoLayoutBtn.click();\n        await page.locator('.layout-item[data-layout=\"top\"]').click();"
);

fs.writeFileSync(testFile, content);
console.log('Fixed e2e tests to not look for layout mode in settings modal');
