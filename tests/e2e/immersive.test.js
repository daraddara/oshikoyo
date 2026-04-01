import { test, expect } from '@playwright/test';

const BASE_SETTINGS = {
    startOfWeek: 0,
    monthCount: 1,
    layoutDirection: 'row',
    layoutMode: 'smart',
    immersiveMode: false,
    oshiList: [],
    mediaMode: 'single',
    mediaPosition: 'top',
};

// イマーシブモードへ移行するヘルパー
async function enterImmersiveMode(page) {
    await page.locator('#btnLayoutMode').click();
    await page.locator('.layout-item[data-layout="immersive"]').click();
    await expect(page.locator('body')).toHaveClass(/is-immersive/, { timeout: 5000 });
}

test.describe('イマーシブモード', () => {
    test.beforeEach(async ({ page, isMobile }, testInfo) => {
        if (isMobile) {
            testInfo.skip();
            return;
        }
        await page.clock.install({ time: new Date('2024-01-01T00:00:00Z') });
        await page.addInitScript((settings) => {
            window.localStorage.setItem('oshikoyo_settings', JSON.stringify(settings));
        }, BASE_SETTINGS);
        await page.goto('/index.html');
        await page.waitForLoadState('networkidle');
        await enterImmersiveMode(page);
    });

    // ----------------------------------------------------------
    // オーバーレイ表示 (PR#76)
    // ----------------------------------------------------------
    test('ミニカレンダーをクリックするとオーバーレイが表示されること', async ({ page }) => {
        const calSection = page.locator('.calendar-section');
        await expect(calSection).toBeVisible();

        await calSection.click({ position: { x: 5, y: 5 } });

        await expect(page.locator('body')).toHaveClass(/show-overlay/);
    });

    test('オーバーレイ表示中はdismiss zoneクリックで閉じること', async ({ page }) => {
        const calSection = page.locator('.calendar-section');
        await calSection.click({ position: { x: 5, y: 5 } });
        await expect(page.locator('body')).toHaveClass(/show-overlay/);

        await page.locator('.overlay-dismiss-zone').click();

        await expect(page.locator('body')).not.toHaveClass(/show-overlay/);
    });

    test('オーバーレイ表示中にカレンダーが正しく描画されること', async ({ page }) => {
        const calSection = page.locator('.calendar-section');
        await calSection.click({ position: { x: 5, y: 5 } });
        await expect(page.locator('body')).toHaveClass(/show-overlay/);

        await expect(page.locator('.calendar-month')).toBeVisible();
        await expect(page.locator('.weekday-header')).toBeVisible();
    });

    // ----------------------------------------------------------
    // ドラッグ/クリック区別 (PR#78)
    // ----------------------------------------------------------
    test('ドラッグ移動後にオーバーレイが表示されないこと', async ({ page }) => {
        const calSection = page.locator('.calendar-section');
        const box = await calSection.boundingBox();
        expect(box).not.toBeNull();

        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx + 60, cy + 60, { steps: 10 });
        await page.mouse.up();

        await expect(page.locator('body')).not.toHaveClass(/show-overlay/);
    });

});
