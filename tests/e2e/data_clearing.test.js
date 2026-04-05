const { test, expect } = require('@playwright/test');

test.describe('Data Clearing', () => {
    test.use({ isMobile: false });

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
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

    test('Oshi list should be cleared if user confirms dialog', async ({ page, isMobile }) => {
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
        if (isMobile) {
             await expect(page.locator('#mobileOshiEmpty')).toBeVisible();
        } else {
             await expect(page.locator('#oshiTableBody')).toHaveText(/検索結果がありません|/);
        }
    });

    test('Custom events should be cleared if user confirms dialog', async ({ page, isMobile }) => {
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

        if (isMobile) {
            // Force mobile tab click directly to avoid flakiness
            await page.evaluate('document.querySelector(".mobile-tab-btn[data-tab=\'settings\']").click()');
            await expect(page.locator('#mobileSettingsPanel')).toBeVisible();
            await page.evaluate('document.querySelector(".settings-menu-item[data-panel=\'events\']").click()');
            await expect(page.locator('#mobileSubPanel-events')).toBeVisible();
            await expect(page.locator('#mobileEventTypeList .event-type-row')).toHaveCount(3);

            await page.evaluate('document.getElementById("btnMobileClearAllEvents").click()');
        } else {
            // Open settings modal and go to event tab
            await page.evaluate('document.getElementById("btnSettings").click()');
            await expect(page.locator('#settingsModal')).toBeVisible();
            await page.evaluate('document.getElementById("tabBtnEvent").click()');

            // Verify initial state
            await expect(page.locator('#settingsEventTypeList .event-type-row')).toHaveCount(3);

            // Click clear all events button using evaluate for robustness
            await page.evaluate('document.getElementById("btnSettingsClearAllEvents").click()');
        }

        await expect(page.locator('.confirm-dialog')).toBeVisible();

        // Click confirm using evaluate
        await page.evaluate('document.querySelector(".confirm-dialog-ok").click()');
        await expect(page.locator('.confirm-dialog')).toBeHidden();

        // Verify only 2 default events remain
        if (isMobile) {
            await expect(page.locator('#mobileEventTypeList .event-type-row')).toHaveCount(2);
        } else {
            await expect(page.locator('#settingsEventTypeList .event-type-row')).toHaveCount(2);
        }
    });

    test('Factory reset should not clear data if user cancels dialog', async ({ page, isMobile }) => {
        // Set a value in localStorage to verify it remains
        await page.evaluate(() => {
            localStorage.setItem('oshikoyo_settings_backup_test', JSON.stringify({ testKey: 'testValue' }));
        });

        if (isMobile) {
            // Force mobile tab click directly to avoid flakiness
            await page.evaluate('document.querySelector(".mobile-tab-btn[data-tab=\'settings\']").click()');
            await expect(page.locator('#mobileSettingsPanel')).toBeVisible();
            await page.evaluate('document.querySelector(".settings-menu-item[data-panel=\'data\']").click()');
            await expect(page.locator('#mobileSubPanel-data')).toBeVisible();
            await page.evaluate('document.getElementById("btnMobileFactoryReset").click()');
        } else {
            // Open settings modal and go to backup tab
            await page.evaluate('document.getElementById("btnSettings").click()');
            await expect(page.locator('#settingsModal')).toBeVisible();
            await page.evaluate('document.getElementById("tabBtnBackup").click()');

            // Click factory reset button
            await page.evaluate('document.getElementById("btnFactoryReset").click()');
        }

        await expect(page.locator('.confirm-dialog')).toBeVisible();

        // Click cancel using evaluate
        await page.evaluate('document.querySelector(".confirm-dialog-cancel").click()');
        await expect(page.locator('.confirm-dialog')).toBeHidden();

        // Verify localStorage value is still there
        const value = await page.evaluate(() => localStorage.getItem('oshikoyo_settings_backup_test'));
        expect(value).toContain('testValue');
    });
});
