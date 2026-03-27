import { test, expect } from '@playwright/test';

const BASE_SETTINGS = {
    startOfWeek: 0,
    monthCount: 2,
    layoutDirection: 'row',
    layoutMode: 'smart',
    immersiveMode: false,
    oshiList: [
        { name: 'テスト長めの名前', color: '#ffb7c5', memorial_dates: [], tags: [] },
        { name: 'テスト推し２',     color: '#3b82f6', memorial_dates: [], tags: [] },
    ],
    mediaMode: 'single',
    mediaPosition: 'top',
    imageCompressMode: 'standard',
};

test.describe('Smoke Test & Layout Verification', () => {
    test('メインUIと設定モーダル全タブが表示されること', async ({ page }) => {
        // 固定の日付を設定（スクリーンショットの差分をなくすため）
        await page.clock.install({ time: new Date('2024-01-01T00:00:00Z') });

        await page.addInitScript((settings) => {
            window.localStorage.setItem('oshikoyo_settings', JSON.stringify(settings));
        }, BASE_SETTINGS);

        await page.goto('http://localhost:8081/index.html');

        // メインUI確認
        const isMobile = await page.evaluate(() => window.innerWidth <= 768);
        if (isMobile) {
            // モバイルではカレンダーは初期非表示。ボトムバーが表示されていることを確認
            await expect(page.locator('.smart-bottom-bar')).toBeVisible();
        } else {
            const calendar = page.locator('#calendarWrapper');
            await expect(calendar).toBeVisible();
            const wrapperOverflowX = await calendar.evaluate((el) => window.getComputedStyle(el).overflowX);
            expect(['auto', 'visible', 'hidden']).toContain(wrapperOverflowX);
        }

        await expect(page).toHaveScreenshot('main_ui.png', { fullPage: true });

        if (isMobile) {
            // モバイルでは設定タブをタップしてモバイル設定パネルを確認
            await page.locator('.mobile-tab-btn[data-tab="settings"]').tap();
            await expect(page.locator('#mobileSettingsPanel')).toBeVisible({ timeout: 3000 });
            await page.waitForTimeout(500);
            await expect(page).toHaveScreenshot('settings_modal_general.png');
            await expect(page).toHaveScreenshot('settings_modal_media.png');
            await expect(page).toHaveScreenshot('settings_modal_data.png');
            // ホームタブに戻る
            await page.locator('.mobile-tab-btn[data-tab="home"]').tap();
        } else {
            // デスクトップでは設定モーダルを開く
            await page.locator('#btnSettings').click();
            const settingsModal = page.locator('#settingsModal');
            await expect(settingsModal).toBeVisible();
            await page.waitForTimeout(500);

            // 一般タブ（デフォルト）
            const scrollArea = settingsModal.locator('.settings-tab-panel.is-active');
            await expect(scrollArea).toBeVisible();
            const overflowY = await scrollArea.evaluate((el) => window.getComputedStyle(el).overflowY);
            expect(['auto', 'scroll']).toContain(overflowY);
            await expect(page).toHaveScreenshot('settings_modal_general.png');

            // 画像タブ
            await page.locator('.settings-tab-btn[data-tab="media"]').click();
            await page.waitForTimeout(300);
            await expect(page).toHaveScreenshot('settings_modal_media.png');

            // データタブ
            await page.locator('.settings-tab-btn[data-tab="data"]').click();
            await page.waitForTimeout(300);
            await expect(page).toHaveScreenshot('settings_modal_data.png');

            // モーダルを閉じる
            await page.locator('#btnClose').click();
            await expect(settingsModal).not.toBeVisible();
        }
    });

    test('推し一覧管理ダイアログが開閉できること', async ({ page }) => {
        await page.clock.install({ time: new Date('2024-01-01T00:00:00Z') });

        await page.addInitScript((settings) => {
            window.localStorage.setItem('oshikoyo_settings', JSON.stringify(settings));
        }, BASE_SETTINGS);

        await page.goto('http://localhost:8081/index.html');

        // 設定モーダルを開く → 一覧を管理
        const isMobile = await page.evaluate(() => window.innerWidth <= 768);

        if (isMobile) {
            // モバイルでは管理タブで推し一覧を確認
            await page.locator('.mobile-tab-btn[data-tab="management"]').tap();
            await expect(page.locator('#mobileManagementPanel')).toBeVisible({ timeout: 3000 });
            await page.waitForTimeout(300);
            await expect(page).toHaveScreenshot('oshi_management_modal.png');
            // ホームタブに戻る
            await page.locator('.mobile-tab-btn[data-tab="home"]').tap();
        } else {
            await page.locator('#btnSettings').click();
            await expect(page.locator('#settingsModal')).toBeVisible();
            await page.locator('#btnOpenOshiManager').click();

            const oshiModal = page.locator('#oshiManagementModal');
            await expect(oshiModal).toBeVisible();
            await page.waitForTimeout(300);
            await expect(page).toHaveScreenshot('oshi_management_modal.png');

            // 閉じる → 設定モーダルに戻ること
            await page.locator('#btnCloseOshiManager').click();
            await expect(oshiModal).not.toBeVisible();
            await expect(page.locator('#settingsModal')).toBeVisible();
        }
    });
});
