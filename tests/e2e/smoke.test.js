import { test, expect } from '@playwright/test';

test.describe('Smoke Test', () => {
    test('should load the index page and show calendar', async ({ page }) => {
        // 開発サーバーのURL。package.jsonで8081ポートを指定している想定
        await page.goto('http://localhost:8081/index.html');

        // タイトルの確認（期待されるタイトルに合わせて調整してください）
        // await expect(page).toHaveTitle(/推しカレ/);

        // カレンダーのメイン要素が表示されていることを確認
        const calendar = page.locator('#calendarWrapper');
        await expect(calendar).toBeVisible();

        // スクリーンショットの保存
        await page.screenshot({ path: 'tests/e2e/screenshots/latest_ui.png', fullPage: true });
    });
});
