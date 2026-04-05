const { test, expect } = require('@playwright/test');

test.describe('Data Clearing', () => {
    test.beforeEach(async ({ page, isMobile }) => {
        // Skip mobile for basic functional tests of these features, assuming logic is shared
        if (isMobile) {
            test.skip();
            return;
        }
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('Oshi list should not be cleared if user cancels dialog', async ({ page }) => {
        // Add a mock oshi first by opening manager and adding one
        await page.evaluate('document.getElementById("btnOpenOshiManager").click()');
        await expect(page.locator('#oshiManagementModal')).toBeVisible();

        await page.locator('#btnOshiAddTop').click();
        await page.locator('#oshiEditName').fill('Test Oshi');
        await page.locator('#btnOshiEditSave').click();

        // Modal should remain open, list should update
        await expect(page.locator('#oshiTableBody tr').first()).toBeVisible();

        // Custom confirm dialog intercept
        // Since the app uses a custom HTML dialog, we need to mock showConfirmDialog or click its buttons
        await page.evaluate('document.getElementById("btnOshiClearAll").click()');
        await expect(page.locator('.confirm-dialog')).toBeVisible();

        // Click cancel on the custom dialog
        await page.locator('.confirm-dialog-actions .btn-cancel').click();

        // Wait a bit to ensure async operations complete if any
        await page.waitForTimeout(500);

        // Verify the oshi is still there
        const listItems = await page.locator('#oshiTableBody tr').count();
        expect(listItems).toBeGreaterThan(0);
    });

    test('Oshi list should be cleared if user confirms dialog', async ({ page }) => {
        // Add a mock oshi first by opening manager and adding one
        await page.evaluate('document.getElementById("btnOpenOshiManager").click()');
        await expect(page.locator('#oshiManagementModal')).toBeVisible();

        await page.locator('#btnOshiAddTop').click();
        await page.locator('#oshiEditName').fill('Test Oshi');
        await page.locator('#btnOshiEditSave').click();

        // Modal should remain open, list should update
        await expect(page.locator('#oshiTableBody tr').first()).toBeVisible();

        // Custom confirm dialog intercept
        await page.evaluate('document.getElementById("btnOshiClearAll").click()');
        await expect(page.locator('.confirm-dialog')).toBeVisible();

        // Click confirm (danger button) on the custom dialog
        await page.locator('.confirm-dialog-actions .btn-danger-solid').click();

        // Wait a bit to ensure async operations complete
        await page.waitForTimeout(500);

        // Verify the oshi list is empty
        const listItems = await page.locator('#oshiTableBody tr').count();
        // It might show a "no results" row, so check count or content
        if (listItems === 1) {
             await expect(page.locator('.oshi-table-no-results')).toBeVisible();
        } else {
             expect(listItems).toBe(0);
        }
    });
});
