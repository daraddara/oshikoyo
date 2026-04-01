/**
 * モバイルポートレート E2Eテスト
 *
 * Galaxy S25相当（360×780 CSS px）のポートレート環境で、
 * PR#145 で実装したモバイルUI機能を自動検証する。
 *
 * 対象プロジェクト: 'Mobile Portrait (Galaxy S25)' (playwright.config.js)
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
 * カレンダーエリアで TouchEvent を dispatch してスワイプをシミュレートする。
 * SWIPE_MIN_PX=50, SWIPE_MAX_MS=400, SWIPE_MAX_VERT_RATIO=0.7 の判定条件を満たす値を使用。
 */
async function swipeCalendar(page, direction) {
    const calWrapper = page.locator('#calendarWrapper');
    const box = await calWrapper.boundingBox();
    expect(box).not.toBeNull();

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const dx = direction === 'left' ? -70 : 70; // ≥ SWIPE_MIN_PX(50px)

    await page.evaluate(({ sx, sy, ex, ey }) => {
        const el = document.getElementById('calendarWrapper');
        el.dispatchEvent(new TouchEvent('touchstart', {
            bubbles: true,
            cancelable: true,
            touches: [new Touch({ identifier: 1, target: el, clientX: sx, clientY: sy })],
        }));
        // 即時 dispatch で dt ≈ 0ms → SWIPE_MAX_MS(400ms) 以内 ✓
        el.dispatchEvent(new TouchEvent('touchend', {
            bubbles: true,
            cancelable: true,
            changedTouches: [new Touch({ identifier: 1, target: el, clientX: ex, clientY: ey })],
        }));
    }, { sx: cx, sy: cy, ex: cx + dx, ey: cy });

    await page.waitForTimeout(100);
}

test.describe('ポートレートモバイルUI検証 (Galaxy S25: 360×780)', () => {
    test.beforeEach(async ({ page }) => {
        await page.clock.install({ time: new Date('2024-01-15T00:00:00Z') });
        await page.addInitScript((settings) => {
            window.localStorage.setItem('oshikoyo_settings', JSON.stringify(settings));
        }, BASE_SETTINGS);
        await page.goto('/index.html');
        await page.waitForLoadState('networkidle');
    });

    // -------------------------------------------------------------------------
    // TC-P-1: FABボタンの表示確認
    // -------------------------------------------------------------------------
    test('TC-P-1: .smart-bottom-bar がポートレートで表示されること', async ({ page }) => {
        const bar = page.locator('.smart-bottom-bar');
        await expect(bar).toBeVisible({ timeout: 5000 });
    });

    // -------------------------------------------------------------------------
    // TC-P-2: 暦タブタップでカレンダートグル
    // -------------------------------------------------------------------------
    test('TC-P-2: カレンダーボタンタップで .calendar-section の is-expanded が切り替わること', async ({ page }) => {
        const calTab  = page.locator('.mobile-tab-btn[data-tab="calendar"]');
        const homeTab = page.locator('.mobile-tab-btn[data-tab="home"]');
        const calSection = page.locator('.calendar-section');

        await expect(calTab).toBeVisible();

        // 初期状態: カレンダーは非表示（is-expanded なし）
        await expect(calSection).not.toHaveClass(/is-expanded/);

        // 暦タブタップ → カレンダー展開
        await calTab.tap();
        await expect(calSection).toHaveClass(/is-expanded/, { timeout: 3000 });

        // ホームタブタップ → カレンダー収納
        await homeTab.tap();
        await expect(calSection).not.toHaveClass(/is-expanded/, { timeout: 3000 });
    });

    // -------------------------------------------------------------------------
    // TC-P-3: カレンダーの左スワイプで翌月へ移動
    // -------------------------------------------------------------------------
    test('TC-P-3: カレンダーを左スワイプすると翌月に移動すること', async ({ page }) => {
        // カレンダーを展開してからスワイプ
        await page.locator('.mobile-tab-btn[data-tab="calendar"]').tap();
        await expect(page.locator('.calendar-section')).toHaveClass(/is-expanded/);

        // 初期: 2024年1月
        await expect(page.locator('.month-title').first()).toContainText('1月');

        await swipeCalendar(page, 'left');

        // 2024年2月に移動
        await expect(page.locator('.month-title').first()).toContainText('2月');
    });

    // -------------------------------------------------------------------------
    // TC-P-3b: カレンダーの右スワイプで前月へ移動
    // -------------------------------------------------------------------------
    test('TC-P-3b: カレンダーを右スワイプすると前月に移動すること', async ({ page }) => {
        await page.locator('.mobile-tab-btn[data-tab="calendar"]').tap();
        await expect(page.locator('.calendar-section')).toHaveClass(/is-expanded/);

        // 初期: 2024年1月
        await expect(page.locator('.month-title').first()).toContainText('1月');

        await swipeCalendar(page, 'right');

        // 2023年12月に移動
        await expect(page.locator('.month-title').first()).toContainText('12月');
    });

    // -------------------------------------------------------------------------
    // TC-P-4: 日付タップで Day Detail Sheet が開く
    // -------------------------------------------------------------------------
    test('TC-P-4: 日付セルタップで #dayDetailSheet が開くこと', async ({ page }) => {
        // カレンダーを展開
        await page.locator('.mobile-tab-btn[data-tab="calendar"]').tap();
        await expect(page.locator('.calendar-section')).toHaveClass(/is-expanded/);
        await expect(page.locator('.calendar-month')).toBeVisible();

        const sheet = page.locator('#dayDetailSheet');
        await expect(sheet).toHaveAttribute('aria-hidden', 'true');

        // other-month でない最初の日付セルをタップ
        const firstDay = page.locator('.day-cell:not(.is-other-month)').first();
        await firstDay.scrollIntoViewIfNeeded();
        await expect(firstDay).toBeVisible();
        await firstDay.tap();
        await page.waitForTimeout(200);

        await expect(sheet).toHaveClass(/is-open/, { timeout: 3000 });
        await expect(sheet).toHaveAttribute('aria-hidden', 'false');
        // 日付ラベルが設定されていること
        await expect(page.locator('#dayDetailDate')).not.toBeEmpty();
    });

    // -------------------------------------------------------------------------
    // TC-P-5: シート外タップで Day Detail Sheet が閉じる
    // -------------------------------------------------------------------------
    test('TC-P-5: シート外タップで #dayDetailSheet が閉じること', async ({ page }) => {
        // カレンダー展開 → 日付タップ → シート表示
        await page.locator('.mobile-tab-btn[data-tab="calendar"]').tap();
        await expect(page.locator('.calendar-section')).toHaveClass(/is-expanded/);

        const firstDay = page.locator('.day-cell:not(.is-other-month)').first();
        await firstDay.tap();

        const sheet = page.locator('#dayDetailSheet');
        await expect(sheet).toHaveClass(/is-open/);

        // シート外（月タイトル行）をクリックして閉じる
        await page.locator('.month-title').first().click();

        await expect(sheet).not.toHaveClass(/is-open/, { timeout: 3000 });
        await expect(sheet).toHaveAttribute('aria-hidden', 'true');
    });

    // -------------------------------------------------------------------------
    // TC-P-6: .media-container が position:fixed でビューポート上部に固定
    // -------------------------------------------------------------------------
    test('TC-P-6: .media-container が position:fixed でビューポート上部に固定されること', async ({ page }) => {
        const position = await page.locator('#mediaContainer').evaluate(
            el => window.getComputedStyle(el).position
        );
        expect(position).toBe('fixed');

        const top = await page.locator('#mediaContainer').evaluate(
            el => el.getBoundingClientRect().top
        );
        expect(top).toBe(0);
    });

    // -------------------------------------------------------------------------
    // TC-P-8: テロップバー表示確認
    // -------------------------------------------------------------------------
    test('TC-P-8: #tickerBar がポートレートで表示されること', async ({ page }) => {
        const ticker = page.locator('#tickerBar');
        await expect(ticker).toBeVisible({ timeout: 3000 });
        // テキストに今日の日付が含まれること
        const span = page.locator('#tickerBar .ticker-text');
        await expect(span).not.toBeEmpty();
        const text = await span.textContent();
        expect(text).toMatch(/月\d+日/);
    });

    // -------------------------------------------------------------------------
    // TC-P-9: 暦タブ再タップで今日に戻ること
    // -------------------------------------------------------------------------
    test('TC-P-9: 暦タブ再タップで currentRefDate が今日に戻ること', async ({ page }) => {
        const calTab = page.locator('.mobile-tab-btn[data-tab="calendar"]');

        // カレンダーを開いて翌月に移動
        await calTab.tap();
        await expect(page.locator('.calendar-section')).toHaveClass(/is-expanded/);
        await page.locator('.month-nav-next').tap();
        await expect(page.locator('.month-title').first()).toContainText('2月');

        // 暦タブを再タップ → 今日（1月）に戻る
        await calTab.tap();
        await expect(page.locator('.month-title').first()).toContainText('1月', { timeout: 3000 });
    });

    // -------------------------------------------------------------------------
    // TC-P-7: スクリーンショット回帰テスト（初期状態）
    // -------------------------------------------------------------------------
    test('TC-P-7: ポートレート初期状態の視覚的回帰テスト', async ({ page }) => {
        await page.waitForTimeout(200);
        await expect(page).toHaveScreenshot('portrait-initial.png');
    });

    // -------------------------------------------------------------------------
    // TC-P-7b: スクリーンショット回帰テスト（カレンダー展開後）
    // -------------------------------------------------------------------------
    test('TC-P-7b: カレンダー展開後の視覚的回帰テスト', async ({ page }) => {
        await page.locator('.mobile-tab-btn[data-tab="calendar"]').tap();
        await expect(page.locator('.calendar-section')).toHaveClass(/is-expanded/);
        await page.waitForTimeout(200);
        await expect(page).toHaveScreenshot('portrait-calendar-expanded.png');
    });
});
