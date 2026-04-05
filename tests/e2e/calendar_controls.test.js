import { test, expect } from '@playwright/test';

const BASE_SETTINGS = {
    startOfWeek: 0,
    monthCount: 2,
    layoutDirection: 'row',
    layoutMode: 'smart',
    immersiveMode: false,
    oshiList: [],
    mediaMode: 'single',
    mediaPosition: 'top',
};

test.describe('カレンダーコントロール', () => {
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
    });

    // ----------------------------------------------------------
    // レイアウト切替ボタン (row ↔ column)
    // ----------------------------------------------------------
    test('レイアウト切替: row→column でカレンダーが縦並びに変わること', async ({ page }) => {
        const wrapper = page.locator('#calendarWrapper');
        await expect(wrapper).toHaveClass(/direction-row/);

        await page.locator('#btnToggleLayout').click();

        await expect(wrapper).toHaveClass(/direction-column/);
        await expect(wrapper).not.toHaveClass(/direction-row/);
    });

    test('レイアウト切替: column→row でカレンダーが横並びに変わること', async ({ page }) => {
        await page.locator('#btnToggleLayout').click();
        await expect(page.locator('#calendarWrapper')).toHaveClass(/direction-column/);

        await page.locator('#btnToggleLayout').click();

        await expect(page.locator('#calendarWrapper')).toHaveClass(/direction-row/);
    });

    test('レイアウト切替: アイコンが現在の状態を反映すること', async ({ page }) => {
        const icon = page.locator('#layoutIcon');

        // row状態: 横並びを示すアイコン（narrow width="10" の矩形2枚）
        const rowHtml = await icon.innerHTML();
        expect(rowHtml).toContain('width="10"');

        await page.locator('#btnToggleLayout').click();

        // column状態: 縦並びを示すアイコン（wide width="21" の矩形2枚）
        const colHtml = await icon.innerHTML();
        expect(colHtml).toContain('width="21"');
    });

    // ----------------------------------------------------------
    // 月数切替ボタン (2ヶ月 ↔ 1ヶ月)
    // ----------------------------------------------------------
    test('月数切替: 2ヶ月→1ヶ月でカレンダーが1枚になること', async ({ page }) => {
        await expect(page.locator('.calendar-month')).toHaveCount(2);

        await page.locator('#btnToggleMonths').click();

        await expect(page.locator('.calendar-month')).toHaveCount(1);
    });

    test('月数切替: 1ヶ月→2ヶ月でカレンダーが2枚になること', async ({ page }) => {
        await page.locator('#btnToggleMonths').click();
        await expect(page.locator('.calendar-month')).toHaveCount(1);

        await page.locator('#btnToggleMonths').click();

        await expect(page.locator('.calendar-month')).toHaveCount(2);
    });

    test('月数切替: ボタンのアイコンが月数に応じて変わること', async ({ page }) => {
        const btn = page.locator('#btnToggleMonths');

        // 2ヶ月: 重ねアイコン (opacity="0.45")
        const twoMonthHtml = await btn.innerHTML();
        expect(twoMonthHtml).toContain('opacity="0.45"');

        await btn.click();

        // 1ヶ月: 単体アイコン (width="18" height="20")
        const oneMonthHtml = await btn.innerHTML();
        expect(oneMonthHtml).not.toContain('opacity="0.45"');
        expect(oneMonthHtml).toContain('width="18"');
    });

    // ----------------------------------------------------------
    // 月ナビゲーション (.month-title で確認)
    // ----------------------------------------------------------
    test('翌月ボタンで表示月が進むこと', async ({ page }) => {
        // 初期: 2024年 1月
        await expect(page.locator('.month-title').first()).toContainText('2024年');
        await expect(page.locator('.month-title').first()).toContainText('1月');

        await page.locator('#btnNext').click();

        await expect(page.locator('.month-title').first()).toContainText('2024年');
        await expect(page.locator('.month-title').first()).toContainText('2月');
    });

    test('前月ボタンで表示月が戻ること', async ({ page }) => {
        await page.locator('#btnPrev').click();

        await expect(page.locator('.month-title').first()).toContainText('2023年');
        await expect(page.locator('.month-title').first()).toContainText('12月');
    });

    test('翌月→前月で元の月に戻ること', async ({ page }) => {
        await page.locator('#btnNext').click();
        await expect(page.locator('.month-title').first()).toContainText('2月');

        await page.locator('#btnPrev').click();

        await expect(page.locator('.month-title').first()).toContainText('1月');
    });

    // ----------------------------------------------------------
    // 設定の永続化 (localStorage値で確認)
    // addInitScript はリロード時も再実行されるため、
    // localStorageへの保存値を直接検証する
    // ----------------------------------------------------------
    test('レイアウト切替後にlocalStorageへ正しく保存されること', async ({ page }) => {
        await page.locator('#btnToggleLayout').click();
        await expect(page.locator('#calendarWrapper')).toHaveClass(/direction-column/);

        const saved = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('oshikoyo_settings'))
        );
        expect(saved.layoutDirection).toBe('column');
    });

    test('月数切替後にlocalStorageへ正しく保存されること', async ({ page }) => {
        await page.locator('#btnToggleMonths').click();
        await expect(page.locator('.calendar-month')).toHaveCount(1);

        const saved = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('oshikoyo_settings'))
        );
        expect(saved.monthCount).toBe(1);
    });

    // ----------------------------------------------------------
    // 今日ボタン (#btnTodayLogo)
    // ----------------------------------------------------------
    test('今日ボタン: 別月に移動後にクリックすると今日の月に戻ること', async ({ page }) => {
        // 翌月（2月）に移動
        await page.locator('#btnNext').click();
        await expect(page.locator('.month-title').first()).toContainText('2月');

        // 今日ボタンをクリック → 1月に戻る
        await page.locator('#btnTodayLogo').click();

        await expect(page.locator('.month-title').first()).toContainText('1月');
    });

    test('今日ボタン: 複数月移動後でも今日の月に戻ること', async ({ page }) => {
        // 3ヶ月先へ移動
        await page.locator('#btnNext').click();
        await page.locator('#btnNext').click();
        await page.locator('#btnNext').click();
        await expect(page.locator('.month-title').first()).toContainText('4月');

        await page.locator('#btnTodayLogo').click();

        await expect(page.locator('.month-title').first()).toContainText('1月');
    });

    // ----------------------------------------------------------
    // 週の開始日切替 (startOfWeek)
    // ----------------------------------------------------------
    test('週の開始日: 月曜始まりに変更すると曜日ヘッダーの先頭が「月」になること', async ({ page }) => {
        // デフォルト（日曜始まり）の確認
        const firstHeader = page.locator('.weekday-header span').first();
        await expect(firstHeader).toHaveText('日');

        // 設定モーダルを開いて月曜始まりに変更
        await page.locator('#btnSettings').click();
        await expect(page.locator('#settingsModal')).toBeVisible();
        await page.locator('input[name="startOfWeek"][value="1"]').click();

        // モーダルを閉じてヘッダーを確認
        await page.locator('#btnClose').click();
        await expect(page.locator('.weekday-header span').first()).toHaveText('月');
    });

    test('週の開始日: 日曜→月曜→日曜と切り替えるとヘッダーが正しく戻ること', async ({ page }) => {
        await page.locator('#btnSettings').click();
        await expect(page.locator('#settingsModal')).toBeVisible();

        // 月曜始まりに変更
        await page.locator('input[name="startOfWeek"][value="1"]').click();
        await page.locator('#btnClose').click();
        await expect(page.locator('.weekday-header span').first()).toHaveText('月');

        // 再び設定を開いて日曜始まりに戻す
        await page.locator('#btnSettings').click();
        await page.locator('input[name="startOfWeek"][value="0"]').click();
        await page.locator('#btnClose').click();
        await expect(page.locator('.weekday-header span').first()).toHaveText('日');
    });

    test('週の開始日: 月曜始まり設定がlocalStorageに保存されること', async ({ page }) => {
        await page.locator('#btnSettings').click();
        await expect(page.locator('#settingsModal')).toBeVisible();
        await page.locator('input[name="startOfWeek"][value="1"]').click();
        await page.locator('#btnClose').click();

        const saved = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('oshikoyo_settings'))
        );
        expect(saved.startOfWeek).toBe(1);
    });
});
