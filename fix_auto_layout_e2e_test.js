const fs = require('fs');

const testFile = 'tests/e2e/auto_layout.test.js';
let content = fs.readFileSync(testFile, 'utf8');

// In auto_layout.test.js, it might still expect 'autoLayoutMode' to exist, let's look.
content = content.replace(/const autoLayoutCheckbox = page\.locator\('#checkAutoLayout'\);/g, "const autoLayoutBtn = page.locator('.layout-mode-btn');");
content = content.replace(/await expect\(autoLayoutCheckbox\)\.toBeVisible\(\);/g, "await expect(autoLayoutBtn).toBeVisible();");
content = content.replace(/await expect\(autoLayoutCheckbox\)\.toBeChecked\(\);/g, "await expect(autoLayoutBtn.locator('.icon-layout-smart')).toBeVisible();");

// The auto_layout tests in E2E might be failing because we removed 'autoLayoutMode' from appSettings entirely, and they probably rely on it or the default state.
// Wait, why did portrait fail? Because appSettings.layoutMode might not be 'smart' in the test context?
// In the setup of the test:
content = content.replace(
    /await page\.evaluate\(\(\) => \{\n\s*window\.appSettings\.autoLayoutMode = true;/g,
    "await page.evaluate(() => {\n            window.appSettings.layoutMode = 'smart';"
);

// We need to replace all `autoLayoutMode = true` and `autoLayoutMode = false` to `layoutMode = 'smart'` and `layoutMode = 'top'` in tests
content = content.replace(/window\.appSettings\.autoLayoutMode = true;/g, "window.appSettings.layoutMode = 'smart';");
content = content.replace(/window\.appSettings\.autoLayoutMode = false;/g, "window.appSettings.layoutMode = 'top';");

// When it toggles auto layout checkbox:
content = content.replace(
    /await autoLayoutCheckbox\.uncheck\(\);/g,
    "await autoLayoutBtn.click(); await page.locator('.layout-item[data-layout=\"top\"]').click();"
);

fs.writeFileSync(testFile, content);
console.log('Fixed e2e auto_layout test.');
