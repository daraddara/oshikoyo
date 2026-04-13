/**
 * 推し永続化・即時反映 E2Eテスト
 *
 * テスト対象:
 * 1. 推し追加後にカレンダーへ即時反映されること（月切り替え不要）
 * 2. 推し追加後に localStorage へ即時保存され、リロード後もデータが残ること
 * 3. モバイルで推し追加後にリロードしてもデータが消えないこと
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

// PWA インストールバナーを JS で強制非表示にするヘルパー
async function dismissPwaBannerIfPresent(page) {
    await page.evaluate(() => {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) banner.style.display = 'none';
    });
}

// 空状態・非空状態どちらでも使える新規追加ボタンを返すヘルパー
async function getMobileAddButton(page) {
    const emptyBtn = page.locator('#btnMobileOshiAddEmpty');
    const topBtn   = page.locator('#btnMobileOshiAddTop');
    const emptyVisible = await emptyBtn.isVisible().catch(() => false);
    return emptyVisible ? emptyBtn : topBtn;
}

// ----------------------------------------------------------
// デスクトップ: カレンダーへの即時反映
// ----------------------------------------------------------
test.describe('カレンダー即時反映（デスクトップ）', () => {
    test.beforeEach(async ({ page, isMobile }, testInfo) => {
        if (isMobile) { testInfo.skip(); return; }
        await page.clock.install({ time: new Date('2024-01-01T00:00:00Z') });
        await page.addInitScript((settings) => {
            window.localStorage.setItem('oshikoyo_settings', JSON.stringify(settings));
        }, BASE_SETTINGS);
        await page.goto('/index.html');
        await page.waitForLoadState('networkidle');
    });

    test('推し追加後に月切り替えなしでカレンダーに .is-oshi-date が表示されること', async ({ page }) => {
        // 設定モーダル → 推し管理モーダルを開く
        await page.locator('#btnSettings').click();
        await expect(page.locator('#settingsModal')).toBeVisible();
        await page.locator('#btnOpenOshiManager').click();
        await expect(page.locator('#oshiManagementModal')).toBeVisible();

        // 新規追加フォームを開く
        await page.locator('#btnOshiAddTop').click();
        await expect(page.locator('#oshiEditModal')).toBeVisible();

        // 名前・カラー・記念日を入力（1/1 = モック日と一致）
        await page.locator('#oshiEditName').fill('即時反映テスト推し');
        await page.locator('#oshiEditColor').fill('#ff69b4');
        await page.locator('#btnAddMemorialDate').click();
        await page.locator('.memorial-date-row .mdate-date').first().fill('1/1');

        // 保存
        await page.locator('#btnOshiEditSave').click();
        await expect(page.locator('#oshiEditModal')).not.toBeVisible();

        // モーダルを閉じる（月切り替えは行わない）
        await page.locator('#btnCloseOshiManager').click();
        await page.locator('#btnClose').click();
        await expect(page.locator('#settingsModal')).not.toBeVisible();

        // 月切り替えなしでカレンダーに記念日セルが表示されること
        await expect(page.locator('.day-cell.is-oshi-date')).toBeVisible({ timeout: 3000 });
        await expect(
            page.locator('.oshi-event[data-oshi-name="即時反映テスト推し"]')
        ).toBeVisible();
    });
});

// ----------------------------------------------------------
// デスクトップ: localStorage 永続化
// ----------------------------------------------------------
test.describe('localStorage 永続化（デスクトップ）', () => {
    test.beforeEach(async ({ page, isMobile }, testInfo) => {
        if (isMobile) { testInfo.skip(); return; }
        await page.clock.install({ time: new Date('2024-01-01T00:00:00Z') });
        // リロード後に上書きしないよう、localStorage が空の場合のみ初期設定を投入する
        await page.addInitScript((settings) => {
            if (!window.localStorage.getItem('oshikoyo_settings')) {
                window.localStorage.setItem('oshikoyo_settings', JSON.stringify(settings));
            }
        }, BASE_SETTINGS);
        await page.goto('/index.html');
        await page.waitForLoadState('networkidle');
    });

    test('推し追加後にリロードしてもデータが消えないこと', async ({ page }) => {
        // 設定モーダル → 推し管理モーダルを開く
        await page.locator('#btnSettings').click();
        await expect(page.locator('#settingsModal')).toBeVisible();
        await page.locator('#btnOpenOshiManager').click();
        await expect(page.locator('#oshiManagementModal')).toBeVisible();

        // 新規追加
        await page.locator('#btnOshiAddTop').click();
        await expect(page.locator('#oshiEditModal')).toBeVisible();
        await page.locator('#oshiEditName').fill('永続化テスト推し');
        await page.locator('#btnOshiEditSave').click();
        await expect(page.locator('#oshiEditModal')).not.toBeVisible();
        // 推し一覧に表示されていることを確認
        await expect(page.locator('#oshiTableBody')).toContainText('永続化テスト推し');
        await page.locator('#btnCloseOshiManager').click();
        await page.locator('#btnClose').click();

        // ページをリロード
        await page.reload();
        await page.waitForLoadState('networkidle');

        // リロード後も推し管理モーダルを開いてデータが残っていること
        await page.locator('#btnSettings').click();
        await expect(page.locator('#settingsModal')).toBeVisible();
        await page.locator('#btnOpenOshiManager').click();
        await expect(page.locator('#oshiManagementModal')).toBeVisible();
        await expect(page.locator('#oshiTableBody')).toContainText('永続化テスト推し');
    });
});

// ----------------------------------------------------------
// モバイル: localStorage 永続化
// モバイルタブバー（.mobile-tab-btn）が表示される環境のみで実行
// ----------------------------------------------------------
test.describe('localStorage 永続化（モバイル）', () => {
    test.beforeEach(async ({ page }) => {
        await page.clock.install({ time: new Date('2024-01-01T00:00:00Z') });
        // リロード後に上書きしないよう、localStorage が空の場合のみ初期設定を投入する
        await page.addInitScript((settings) => {
            if (!window.localStorage.getItem('oshikoyo_settings')) {
                window.localStorage.setItem('oshikoyo_settings', JSON.stringify(settings));
            }
        }, BASE_SETTINGS);
        await page.goto('/index.html');
        await page.waitForLoadState('networkidle');
    });

    test('モバイルで推し追加後にリロードしてもデータが消えないこと', async ({ page }) => {
        // モバイルタブバーが存在しない環境（デスクトップ等）はスキップ
        const managementTab = page.locator('.mobile-tab-btn[data-tab="management"]');
        const tabBarVisible = await managementTab.isVisible().catch(() => false);
        if (!tabBarVisible) { test.skip(); return; }

        // PWA インストールバナーが出ていれば JS で非表示にする
        await dismissPwaBannerIfPresent(page);

        // 管理タブへ移動
        await managementTab.tap();

        // 空状態ボタンまたは上部ボタンを取得してタップ
        const addBtn = await getMobileAddButton(page);
        await expect(addBtn).toBeVisible({ timeout: 3000 });
        await addBtn.tap();

        // 編集フォームが開くこと
        await expect(page.locator('#oshiEditModal')).toBeVisible({ timeout: 3000 });

        // 名前を入力して保存
        await page.locator('#oshiEditName').fill('モバイル永続化テスト推し');
        await page.locator('#btnOshiEditSave').tap();
        await expect(page.locator('#oshiEditModal')).not.toBeVisible({ timeout: 3000 });

        // 管理パネルに追加されたことを確認
        await expect(page.locator('#mobileOshiList')).toContainText('モバイル永続化テスト推し', { timeout: 3000 });

        // ページをリロード
        await page.reload();
        await page.waitForLoadState('networkidle');

        // PWA インストールバナーが出ていれば JS で非表示にする
        await dismissPwaBannerIfPresent(page);

        // リロード後に管理タブへ移動
        await page.locator('.mobile-tab-btn[data-tab="management"]').tap();

        // データが残っていること
        await expect(page.locator('#mobileOshiList')).toContainText('モバイル永続化テスト推し', { timeout: 3000 });
    });
});
