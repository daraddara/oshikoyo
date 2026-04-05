/**
 * 推し管理 E2Eテスト（デスクトップ）
 *
 * テスト対象:
 * 1. 推し追加フロー（新規追加→フォーム入力→保存→一覧反映）
 * 2. 推し追加後に記念日がカレンダーに表示されること
 * 3. 推し削除フロー
 *
 * モバイルでは推し管理UIが異なるため、デスクトップのみで実行。
 */
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
    imageCompressMode: 'standard',
};

/** 設定モーダル→推し管理モーダルを開くヘルパー */
async function openOshiManager(page) {
    await page.locator('#btnSettings').click();
    await expect(page.locator('#settingsModal')).toBeVisible();
    await page.locator('#btnOpenOshiManager').click();
    await expect(page.locator('#oshiManagementModal')).toBeVisible();
}

/** 新規追加フォームを開くヘルパー（管理モーダルが開いている状態から）*/
async function clickAddNew(page) {
    await page.locator('#btnOshiAddTop').click();
    await expect(page.locator('#oshiEditModal')).toBeVisible();
}

test.describe('推し管理', () => {
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
    // 推し追加フロー
    // ----------------------------------------------------------
    test('推し追加: 新規追加フォームが「新規追加」タイトルで開くこと', async ({ page }) => {
        await openOshiManager(page);
        await clickAddNew(page);

        await expect(page.locator('#oshiEditTitle')).toHaveText('新規追加');
        await expect(page.locator('#oshiEditName')).toBeVisible();
        await expect(page.locator('#oshiEditColor')).toBeVisible();
    });

    test('推し追加: 名前を入力して保存すると推し一覧に反映されること', async ({ page }) => {
        await openOshiManager(page);
        await clickAddNew(page);

        await page.locator('#oshiEditName').fill('テスト推し');
        await page.locator('#oshiEditColor').fill('#ff69b4');
        await page.locator('#btnOshiEditSave').click();

        // 編集モーダルが閉じること
        await expect(page.locator('#oshiEditModal')).not.toBeVisible();

        // 推し一覧テーブルに名前が表示されること
        await expect(page.locator('#oshiTableBody')).toContainText('テスト推し');
    });

    test('推し追加: 名前が空のまま保存するとトーストが表示されエラーになること', async ({ page }) => {
        await openOshiManager(page);
        await clickAddNew(page);

        // 名前を入力せずに保存
        await page.locator('#btnOshiEditSave').click();

        // 編集モーダルが閉じないこと
        await expect(page.locator('#oshiEditModal')).toBeVisible();

        // トースト通知が表示されること（クラス名: toast-message）
        await expect(page.locator('.toast-message')).toBeVisible({ timeout: 3000 });
    });

    test('推し追加: キャンセルで編集モーダルが閉じ一覧に追加されないこと', async ({ page }) => {
        await openOshiManager(page);
        await clickAddNew(page);

        await page.locator('#oshiEditName').fill('キャンセルテスト');
        await page.locator('#btnOshiEditCancel').click();

        await expect(page.locator('#oshiEditModal')).not.toBeVisible();
        await expect(page.locator('#oshiTableBody')).not.toContainText('キャンセルテスト');
    });

    // ----------------------------------------------------------
    // 記念日のカレンダー表示
    // ----------------------------------------------------------
    test('記念日: 推し追加後に記念日がカレンダーセルに表示されること', async ({ page }) => {
        await openOshiManager(page);
        await clickAddNew(page);

        // 名前・カラーを設定
        await page.locator('#oshiEditName').fill('記念日テスト推し');
        await page.locator('#oshiEditColor').fill('#ffb7c5');

        // 記念日を追加: 1/1（モック日 = 2024-01-01 に一致させる）
        await page.locator('#btnAddMemorialDate').click();
        const memRow = page.locator('.memorial-date-row').first();
        await memRow.locator('.mdate-date').fill('1/1');

        await page.locator('#btnOshiEditSave').click();
        await expect(page.locator('#oshiEditModal')).not.toBeVisible();

        // 管理モーダルを閉じる
        await page.locator('#btnCloseOshiManager').click();

        // 設定モーダルを閉じる
        await page.locator('#btnClose').click();
        await expect(page.locator('#settingsModal')).not.toBeVisible();

        // 月ナビゲーションで updateView() をトリガーしてカレンダーを再描画
        // （saveOshiFromForm は updateView を呼ばないため）
        await page.locator('#btnNext').click();
        await page.locator('#btnPrev').click();

        // カレンダーに記念日セルが表示されていること
        await expect(page.locator('.day-cell.is-oshi-date')).toBeVisible({ timeout: 3000 });

        // 追加した推し名のイベントラベルが存在すること
        await expect(
            page.locator('.oshi-event[data-oshi-name="記念日テスト推し"]')
        ).toBeVisible();
    });

    test('記念日: 日付が一致する日のセルに .is-oshi-date クラスが付与されること', async ({ page }) => {
        await openOshiManager(page);
        await clickAddNew(page);

        await page.locator('#oshiEditName').fill('クラステスト推し');
        await page.locator('#oshiEditColor').fill('#3b82f6');
        await page.locator('#btnAddMemorialDate').click();
        await page.locator('.memorial-date-row .mdate-date').first().fill('1/1');
        await page.locator('#btnOshiEditSave').click();
        await expect(page.locator('#oshiEditModal')).not.toBeVisible();

        await page.locator('#btnCloseOshiManager').click();
        await page.locator('#btnClose').click();

        // 月ナビゲーションでカレンダーを再描画
        await page.locator('#btnNext').click();
        await page.locator('#btnPrev').click();

        // is-oshi-date セルが存在し、かつ other-month ではないこと
        const oshiCell = page.locator('.day-cell.is-oshi-date:not(.is-other-month)');
        await expect(oshiCell).toBeVisible({ timeout: 3000 });
    });

    // ----------------------------------------------------------
    // 推し削除フロー
    // ----------------------------------------------------------
    test('推し削除: 削除ボタンを押して確認すると推しが一覧から消えること', async ({ page }) => {
        await openOshiManager(page);
        await clickAddNew(page);

        await page.locator('#oshiEditName').fill('削除テスト推し');
        await page.locator('#btnOshiEditSave').click();
        await expect(page.locator('#oshiTableBody')).toContainText('削除テスト推し');

        // テーブル行の削除ボタン（btn-icon-delete）をクリック
        const row = page.locator('#oshiTableBody tr', { hasText: '削除テスト推し' });
        await row.locator('.btn-icon-delete').click();

        // カスタム確認ダイアログが表示されること
        const confirmDialog = page.locator('.confirm-dialog');
        await expect(confirmDialog).toBeVisible({ timeout: 3000 });

        // 削除を確認
        await confirmDialog.locator('.confirm-dialog-ok').click();
        await expect(confirmDialog).not.toBeVisible();

        // 推しが一覧から消えること
        await expect(page.locator('#oshiTableBody')).not.toContainText('削除テスト推し');
    });

    test('推し削除: 確認ダイアログでキャンセルすると推しが残ること', async ({ page }) => {
        await openOshiManager(page);
        await clickAddNew(page);

        await page.locator('#oshiEditName').fill('キャンセル削除テスト');
        await page.locator('#btnOshiEditSave').click();
        await expect(page.locator('#oshiTableBody')).toContainText('キャンセル削除テスト');

        // 削除ボタンをクリック → ダイアログが出る
        const row = page.locator('#oshiTableBody tr', { hasText: 'キャンセル削除テスト' });
        await row.locator('.btn-icon-delete').click();

        const confirmDialog = page.locator('.confirm-dialog');
        await expect(confirmDialog).toBeVisible({ timeout: 3000 });

        // キャンセルを押す
        await confirmDialog.locator('.confirm-dialog-cancel').click();
        await expect(confirmDialog).not.toBeVisible();

        // 推しが一覧に残ること
        await expect(page.locator('#oshiTableBody')).toContainText('キャンセル削除テスト');
    });
});
