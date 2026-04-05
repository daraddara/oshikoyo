/**
 * モバイルポートレート E2Eテスト
 *
 * Galaxy S25相当（360×780 CSS px）のポートレート環境で、
 * PR#145 で実装したモバイルUI機能を自動検証する。
 *
 * 対象プロジェクト: 'Mobile Portrait (Galaxy S25)' (playwright.config.js)
 */
import { test, expect } from '@playwright/test';

/** CSS アニメーション/トランジションがすべて完了するまで待機する（最大1500ms） */
async function waitForAnimations(page) {
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForFunction(
        () => document.getAnimations().filter(a => a.playState === 'running').length === 0,
        null,
        { timeout: 1500 }
    ).catch(() => {}); // 永続アニメーション時はタイムアウトを無視して続行
}

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

    // スワイプ前の月タイトルを記録
    const titleBefore = await page.locator('.month-title').first().textContent();

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

    // 月タイトルが変化するまで待機（固定時間待ちを排除）
    await page.waitForFunction(
        (before) => {
            const el = document.querySelector('.month-title');
            return el && el.textContent !== before;
        },
        titleBefore
    );
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
        await waitForAnimations(page);
        await expect(page).toHaveScreenshot('portrait-initial.png');
    });

    // -------------------------------------------------------------------------
    // TC-P-7b: スクリーンショット回帰テスト（カレンダー展開後）
    // -------------------------------------------------------------------------
    test('TC-P-7b: カレンダー展開後の視覚的回帰テスト', async ({ page }) => {
        await page.locator('.mobile-tab-btn[data-tab="calendar"]').tap();
        await expect(page.locator('.calendar-section')).toHaveClass(/is-expanded/);
        await waitForAnimations(page);
        await expect(page).toHaveScreenshot('portrait-calendar-expanded.png');
    });

    // -------------------------------------------------------------------------
    // TC-P-10: ホームタブポップオーバー（再生モード設定）
    // -------------------------------------------------------------------------
    test('TC-P-10: ホームタブタップで #mobilePlaybackPopover が開くこと', async ({ page }) => {
        const pop = page.locator('#mobilePlaybackPopover');

        // 初期状態: ポップオーバーは非表示
        await expect(pop).not.toHaveClass(/is-visible/);

        // ホームタブをタップ（初期タブがhomeなので、タップでポップオーバーが開く）
        await page.locator('.mobile-tab-btn[data-tab="home"]').tap();

        await expect(pop).toHaveClass(/is-visible/, { timeout: 3000 });
    });

    test('TC-P-11: ポップオーバーに表示モードボタンが表示されること', async ({ page }) => {
        await page.locator('.mobile-tab-btn[data-tab="home"]').tap();
        const pop = page.locator('#mobilePlaybackPopover');
        await expect(pop).toHaveClass(/is-visible/);

        // 手動・ランダム・サイクルのボタンが存在すること
        await expect(pop.locator('[data-mode="single"]')).toBeVisible();
        await expect(pop.locator('[data-mode="random"]')).toBeVisible();
        await expect(pop.locator('[data-mode="cycle"]')).toBeVisible();
    });

    test('TC-P-12: ポップオーバーで表示モードを切り替えると設定が変わること', async ({ page }) => {
        await page.locator('.mobile-tab-btn[data-tab="home"]').tap();
        const pop = page.locator('#mobilePlaybackPopover');
        await expect(pop).toHaveClass(/is-visible/);

        // デフォルトは 'single'（手動）→ 'random' に切り替え
        await pop.locator('[data-mode="random"]').tap();

        // localStorageに保存されること
        const saved = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('oshikoyo_settings'))
        );
        expect(saved.mediaMode).toBe('random');
    });

    test('TC-P-13: ポップオーバー外タップで閉じること', async ({ page }) => {
        await page.locator('.mobile-tab-btn[data-tab="home"]').tap();
        const pop = page.locator('#mobilePlaybackPopover');
        await expect(pop).toHaveClass(/is-visible/);

        // ポップオーバー外（カレンダータブ）をタップして閉じる
        await page.locator('.mobile-tab-btn[data-tab="calendar"]').tap();
        await expect(pop).not.toHaveClass(/is-visible/, { timeout: 3000 });
    });
});
