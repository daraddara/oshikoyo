const { test, expect } = require('@playwright/test');

test.describe('Data Clearing', () => {
    test.use({ isMobile: false, viewport: { width: 1280, height: 720 } });

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        // Give time for initial script to bind before evaluate
        await page.waitForFunction(() => window.appSettings !== undefined);
    });

    test('Oshi list should not be cleared if user cancels dialog', async ({ page }) => {
        // Setup initial state with evaluate to be robust across viewports
        await page.evaluate(() => {
            window.appSettings.oshiList = [{
                id: 'test_1',
                name: 'Test Oshi',
                events: []
            }];
            window.saveSettingsSilently();
            window.updateView();
            window.renderOshiList();
        });

        // Open manager
        await page.evaluate('document.getElementById("btnOpenOshiManager").click()');
        await expect(page.locator('#oshiManagementModal')).toBeVisible();
        await expect(page.locator('#oshiTableBody tr').first()).toBeVisible();

        // Click Clear All button using evaluate
        await page.evaluate('document.getElementById("btnOshiClearAll").click()');
        await expect(page.locator('.confirm-dialog')).toBeVisible();

        // Click cancel on the custom dialog using evaluate
        await page.evaluate('document.querySelector(".confirm-dialog-cancel").click()');

        // Verify the dialog closed
        await expect(page.locator('.confirm-dialog')).toBeHidden();

        // Verify the oshi is still there by asserting the row is visible
        await expect(page.locator('#oshiTableBody tr').first()).toBeVisible();
    });

    test('Oshi list should be cleared if user confirms dialog', async ({ page }) => {
        // Setup initial state
        await page.evaluate(() => {
            window.appSettings.oshiList = [{
                id: 'test_1',
                name: 'Test Oshi',
                events: []
            }];
            window.saveSettingsSilently();
            window.updateView();
            window.renderOshiList();
        });

        // Open manager
        await page.evaluate('document.getElementById("btnOpenOshiManager").click()');
        await expect(page.locator('#oshiManagementModal')).toBeVisible();
        await expect(page.locator('#oshiTableBody tr').first()).toBeVisible();

        // Click Clear All button
        await page.evaluate('document.getElementById("btnOshiClearAll").click()');
        await expect(page.locator('.confirm-dialog')).toBeVisible();

        // Click confirm (danger button) on the custom dialog using evaluate
        await page.evaluate('document.querySelector(".confirm-dialog-ok").click()');

        // Verify the dialog closed
        await expect(page.locator('.confirm-dialog')).toBeHidden();

        // Verify the oshi list is empty
        const oshiCount = await page.evaluate(() => window.appSettings.oshiList.length);
        expect(oshiCount).toBe(0);
    });

    test('Custom events should be cleared if user confirms dialog', async ({ page }) => {
        // Setup initial state
        await page.evaluate(() => {
            window.appSettings.event_types = [
                { id: 'bday', label: '誕生日', icon: 'cake' },
                { id: 'debut', label: 'デビュー記念日', icon: 'star' },
                { id: 'ev_custom1', label: 'Custom 1', icon: 'star' }
            ];
            window.saveSettingsSilently();
            window.updateView();
            // Force re-render depending on mobile or desktop
            if (window.renderEventTypeManager) window.renderEventTypeManager();
            if (window.renderMobileEventTypeSection) window.renderMobileEventTypeSection();
        });

        // Both mobile and desktop DOM contain the desktop settings modal and render it.
        // By evaluating click on `#btnSettingsClearAllEvents` directly, it will clear settings.
        await page.evaluate('document.getElementById("btnSettingsClearAllEvents").click()');

        await expect(page.locator('.confirm-dialog')).toBeVisible();

        // Click confirm using evaluate
        await page.evaluate('document.querySelector(".confirm-dialog-ok").click()');
        await expect(page.locator('.confirm-dialog')).toBeHidden();

        // Verify only 2 default events remain
        const eventCount = await page.evaluate(() => window.appSettings.event_types.length);
        expect(eventCount).toBe(2);
    });

    test('Factory reset should not clear data if user cancels dialog', async ({ page }) => {
        // Set a value in localStorage to verify it remains
        await page.evaluate(() => {
            localStorage.setItem('oshikoyo_settings_backup_test', JSON.stringify({ testKey: 'testValue' }));
        });

        // Trigger factory reset
        await page.evaluate('document.getElementById("btnFactoryReset").click()');

        await expect(page.locator('.confirm-dialog')).toBeVisible();

        // Click cancel using evaluate
        await page.evaluate('document.querySelector(".confirm-dialog-cancel").click()');
        await expect(page.locator('.confirm-dialog')).toBeHidden();

        // Verify localStorage value is still there
        const value = await page.evaluate(() => localStorage.getItem('oshikoyo_settings_backup_test'));
        expect(value).toContain('testValue');
    });
});
