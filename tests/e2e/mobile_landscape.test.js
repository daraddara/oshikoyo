/**
 * モバイルランドスケープ E2Eテスト
 *
 * Galaxy S25相当（702×360 CSS px）のランドスケープ環境で、
 * PR#145 モバイル最適化で修正した問題の回帰を自動検知する。
 *
 * 対象プロジェクト: 'Mobile Landscape (Galaxy S25)' (playwright.config.js)
 * viewport: 702×360 → orientation:landscape / max-height:500px / max-width:768px が同時適用される
 */
import { test, expect } from '@playwright/test';

const BASE_SETTINGS = {
    startOfWeek: 0,
    monthCount: 1,
    layoutDirection: 'column',
    layoutMode: 'manual',
    immersiveMode: false,
    oshiList: [],
    mediaMode: 'single',
    mediaPosition: 'left',
    imageCompressMode: 'standard',
};

/**
 * ポートレート画像（縦長）をモック注入する。
 * backdrop も同時に挿入し、ランドスケープCSSの両側ぼかし表示を再現する。
 * auto_layout.test.js の確立済みパターンを踏襲。
 */
async function injectMockPortraitImage(page) {
    await page.evaluate(async () => {
        if (window.mediaTimer) {
            clearInterval(window.mediaTimer);
            clearTimeout(window.mediaTimer);
        }
        if (window.localImageDB) {
            window.localImageDB.getAllKeys = async () => [1];
            window.localImageDB.getImage = async () => {
                const res = await fetch('/tests/fixtures/images/test_portrait.png');
                return { file: await res.blob() };
            };
        }

        const container = document.getElementById('mediaContainer');
        let cl = container.querySelector('.media-content-layer');
        if (!cl) {
            cl = document.createElement('div');
            cl.className = 'media-content-layer';
            container.appendChild(cl);
        }
        let da = cl.querySelector('.media-display-area');
        if (!da) {
            da = document.createElement('div');
            da.className = 'media-display-area';
            cl.appendChild(da);
        }
        da.innerHTML = '';

        // backdrop（ぼかし背景）
        const bd = document.createElement('img');
        bd.className = 'media-backdrop';
        bd.src = '/tests/fixtures/images/test_portrait.png';
        da.appendChild(bd);

        // メイン画像（縦長: 600×1200 相当）
        const img = document.createElement('img');
        img.className = 'media-main-img';
        Object.defineProperty(img, 'naturalWidth',  { get: () => 600,  configurable: true });
        Object.defineProperty(img, 'naturalHeight', { get: () => 1200, configurable: true });
        da.appendChild(img);
        await new Promise(r => { img.onload = img.onerror = r; img.src = '/tests/fixtures/images/test_portrait.png'; });

        window.appSettings.mediaPosition = 'left';
        window.updateView();
    });
    await page.waitForTimeout(400);
}

test.describe('ランドスケープレイアウト検証 (Galaxy S25: 702×360)', () => {
    test.beforeEach(async ({ page }) => {
        await page.clock.install({ time: new Date('2024-01-15T00:00:00Z') });
        await page.addInitScript((settings) => {
            window.localStorage.setItem('oshikoyo_settings', JSON.stringify(settings));
        }, BASE_SETTINGS);
        await page.goto('/index.html');
        await page.waitForLoadState('networkidle');
    });

    // -------------------------------------------------------------------------
    // TC-L-1: 60/40 レイアウト分割の確認
    // -------------------------------------------------------------------------
    test('TC-L-1: .media-area が約60%幅、.calendar-section が約40%幅で横並びになること', async ({ page }) => {
        await injectMockPortraitImage(page);

        const mediaAreaWidth = await page.locator('#mediaArea').evaluate(
            el => el.getBoundingClientRect().width
        );
        const calSectionWidth = await page.locator('.calendar-section').evaluate(
            el => el.getBoundingClientRect().width
        );

        // 702px × 60% = 421.2px、誤差 ±3px を許容
        expect(mediaAreaWidth).toBeGreaterThanOrEqual(418);
        expect(mediaAreaWidth).toBeLessThanOrEqual(424);

        // 702px × 40% = 280.8px、誤差 ±3px を許容
        expect(calSectionWidth).toBeGreaterThanOrEqual(278);
        expect(calSectionWidth).toBeLessThanOrEqual(284);
    });

    // -------------------------------------------------------------------------
    // TC-L-2: mc=0 問題の回帰防止（.media-container が y=0 に配置されること）
    // -------------------------------------------------------------------------
    test('TC-L-2: .media-container の top が 0px であること（mc=146問題の回帰防止）', async ({ page }) => {
        await injectMockPortraitImage(page);

        const containerTop = await page.locator('#mediaContainer').evaluate(
            el => el.getBoundingClientRect().top
        );

        expect(containerTop).toBe(0);
    });

    // -------------------------------------------------------------------------
    // TC-L-3: 画像センタリング確認（右ずれ問題の回帰防止）
    // -------------------------------------------------------------------------
    test('TC-L-3: .media-main-img が .media-display-area 内でセンタリングされていること', async ({ page }) => {
        await injectMockPortraitImage(page);
        await page.waitForSelector('.media-main-img', { state: 'visible' });

        const result = await page.evaluate(() => {
            const img = document.querySelector('.media-main-img');
            const da  = document.querySelector('.media-display-area');
            if (!img || !da) return null;

            const ir = img.getBoundingClientRect();
            const dr = da.getBoundingClientRect();
            const leftGap  = ir.left - dr.left;
            const rightGap = dr.right - ir.right;

            return {
                leftGap,
                rightGap,
                diff: Math.abs(leftGap - rightGap),
                imgWidth: ir.width,
                daWidth: dr.width,
            };
        });

        expect(result).not.toBeNull();
        // 左右の余白差が 2px 以内 → センタリングされている
        expect(result.diff).toBeLessThanOrEqual(2);
        // 画像がdisplayAreaからはみ出していないこと
        expect(result.imgWidth).toBeLessThanOrEqual(result.daWidth + 1);
    });

    // -------------------------------------------------------------------------
    // TC-L-4: backdrop 全幅カバー確認（右側が暗くなる問題の回帰防止）
    // -------------------------------------------------------------------------
    test('TC-L-4: .media-backdrop の幅が .media-content-layer の幅と一致すること', async ({ page }) => {
        await injectMockPortraitImage(page);

        const result = await page.evaluate(() => {
            const backdrop     = document.querySelector('.media-backdrop');
            const contentLayer = document.querySelector('.media-content-layer');
            if (!backdrop || !contentLayer) return null;

            // getBoundingClientRect() は transform:scale(1.1) 適用後のサイズを返すため、
            // offsetWidth（transform 前のレイアウトサイズ）で比較する
            return {
                backdropOffsetWidth: backdrop.offsetWidth,
                clOffsetWidth: contentLayer.offsetWidth,
                widthDiff: Math.abs(backdrop.offsetWidth - contentLayer.offsetWidth),
            };
        });

        expect(result).not.toBeNull();
        // backdrop のレイアウト幅（scale前）が contentLayer 幅と ±2px 以内で一致
        expect(result.widthDiff).toBeLessThanOrEqual(2);
    });

    // -------------------------------------------------------------------------
    // TC-L-5: カレンダーが viewport 右半分に配置されていること
    // -------------------------------------------------------------------------
    test('TC-L-5: .calendar-section が viewport の右半分（left > 351px）に配置されること', async ({ page }) => {
        await injectMockPortraitImage(page);

        const calLeft = await page.locator('.calendar-section').evaluate(
            el => el.getBoundingClientRect().left
        );

        // 702px / 2 = 351px。カレンダーの左端は右半分にあるべき
        expect(calLeft).toBeGreaterThan(351);
    });

    // -------------------------------------------------------------------------
    // TC-L-6: FABボタンがランドスケープでは非表示
    // -------------------------------------------------------------------------
    test('TC-L-6: .mobile-cal-btn がランドスケープでは非表示であること', async ({ page }) => {
        await injectMockPortraitImage(page);

        const count = await page.locator('.mobile-cal-btn').count();
        if (count > 0) {
            await expect(page.locator('.mobile-cal-btn')).toBeHidden();
        }
        // 要素が存在しない場合もテストは合格（ランドスケープでは追加しない実装も合格）
    });

    // -------------------------------------------------------------------------
    // TC-L-7: メディアクエリ適用確認
    // -------------------------------------------------------------------------
    test('TC-L-7: ランドスケープメディアクエリが適用されていること', async ({ page }) => {
        const isLandscapeQuery = await page.evaluate(() =>
            window.matchMedia('(max-height: 500px) and (orientation: landscape)').matches
        );
        const isPortraitMobileQuery = await page.evaluate(() =>
            window.matchMedia('(max-width: 768px)').matches
        );

        // 両クエリが同時適用されている（Galaxy S25のデュアルクエリ環境の再現確認）
        expect(isLandscapeQuery).toBe(true);
        expect(isPortraitMobileQuery).toBe(true);
    });

    // -------------------------------------------------------------------------
    // TC-L-8: スクリーンショット回帰テスト
    // -------------------------------------------------------------------------
    test('TC-L-8: ランドスケープレイアウトの視覚的回帰テスト', async ({ page }) => {
        await injectMockPortraitImage(page);
        await page.waitForSelector('.media-main-img', { state: 'visible' });
        await page.waitForTimeout(200);

        await expect(page).toHaveScreenshot('landscape-with-portrait-image.png');
    });
});
