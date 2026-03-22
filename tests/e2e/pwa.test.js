/**
 * PWA 動作確認テスト（Playwright E2E）
 *
 * テスト対象:
 * 1. Service Worker の登録確認
 * 2. オフライン動作確認（SW キャッシュによる配信）
 *
 * 注:
 * - Desktop Chromium のみで実行（Service Worker の挙動はブラウザエンジン依存）
 * - インストールプロンプト・ホーム画面追加はブラウザUIのため自動化対象外
 * - `serviceworker` イベントは BrowserContext レベルで発火する（page レベルではない）
 */

import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../test-config.js';

// Desktop Chromium のみで実行
test.use({ browserName: 'chromium' });
test.skip(({ isMobile }) => isMobile, 'Desktop Chromium のみ対象');

test.describe('PWA: Service Worker', () => {
    test('Service Worker (sw.js) が登録・アクティブになる', async ({ page }) => {
        await page.goto('http://localhost:8081/');

        // navigator.serviceWorker.ready で登録済みSWを取得
        const swUrl = await page.evaluate(async () => {
            const reg = await navigator.serviceWorker.ready;
            return reg.active?.scriptURL ?? null;
        });

        expect(swUrl).toContain('sw.js');
    });

    test('Service Worker が BrowserContext に登録される', async ({ context, page }) => {
        // serviceworker イベントは context レベルで発火する
        const swPromise = context.waitForEvent('serviceworker', {
            timeout: TEST_CONFIG.timeouts.long
        });

        await page.goto('http://localhost:8081/');

        // SW が既に登録済みの場合はイベントが発火しない可能性がある
        // そのため ready 経由でも確認
        const [sw] = await Promise.all([
            swPromise.catch(() => null), // イベントが来なくても続行
            page.evaluate(() => navigator.serviceWorker.ready)
        ]);

        if (sw) {
            expect(sw.url()).toContain('sw.js');
        } else {
            // SW 既に登録済み: ready から確認
            const swUrl = await page.evaluate(async () => {
                const reg = await navigator.serviceWorker.ready;
                return reg.active?.scriptURL ?? null;
            });
            expect(swUrl).toContain('sw.js');
        }
    });
});

test.describe('PWA: オフライン動作', () => {
    test('SW キャッシュ経由でオフラインでもアプリが表示される', async ({ page, context }) => {
        // 1. オンライン状態でアクセスして SW にキャッシュを温める
        await page.goto('http://localhost:8081/');

        // SW が ready になるまで待つ
        await page.evaluate(
            () => navigator.serviceWorker.ready,
            { timeout: TEST_CONFIG.timeouts.long }
        );

        // SW がページをコントロールするまで待つ
        await page.waitForFunction(
            () => navigator.serviceWorker.controller !== null,
            { timeout: TEST_CONFIG.timeouts.medium }
        );

        // 2. ネットワークを遮断
        await context.setOffline(true);

        // 3. リロードしてもカレンダーが表示されることを確認
        await page.reload({ waitUntil: 'domcontentloaded', timeout: TEST_CONFIG.timeouts.nav });
        await expect(page.locator('#calendarWrapper')).toBeVisible({
            timeout: TEST_CONFIG.timeouts.medium
        });
    });

    test('オフライン時でも設定モーダルが開ける', async ({ page, context }) => {
        await page.goto('http://localhost:8081/');

        await page.evaluate(() => navigator.serviceWorker.ready);
        await page.waitForFunction(
            () => navigator.serviceWorker.controller !== null,
            { timeout: TEST_CONFIG.timeouts.medium }
        );

        await context.setOffline(true);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: TEST_CONFIG.timeouts.nav });

        await page.locator('#btnSettings').click();
        await expect(page.locator('#settingsModal')).toBeVisible({
            timeout: TEST_CONFIG.timeouts.short
        });
    });
});
