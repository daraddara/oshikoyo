const fs = require('fs');

const testFile = 'tests/e2e/auto_layout.test.js';
let content = fs.readFileSync(testFile, 'utf8');

// The replacement in fix_auto_layout_e2e_test2.js failed because I used the wrong regex, or the first replacement changed the file in a way I didn't expect. Let's rewrite the entire beforeEach.

const newBeforeEach = `test.beforeEach(async ({ page }) => {
        await page.clock.install({ time: new Date('2025-01-01T12:00:00') });
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Verify the new layout mode button is present instead of the old settings checkbox
        const autoLayoutBtn = page.locator('.layout-mode-btn');
        await expect(autoLayoutBtn).toBeVisible();
    });`;

// Replace everything from test.beforeEach(async ({ page }) => { to the end of the beforeEach block
content = content.replace(/test\.beforeEach\(async \(\{ page \}\) => \{[\s\S]*?\}\);/, newBeforeEach);

// Remove the `if (!(await autoLayoutCheckbox.isChecked())) {` blocks
content = content.replace(/if \(!\(await autoLayoutCheckbox\.isChecked\(\)\)\) \{[\s\S]*?\}/g, '');
content = content.replace(/const autoLayoutCheckbox = [^\n]*\n/g, '');

fs.writeFileSync(testFile, content);
console.log('Fixed auto layout tests');
