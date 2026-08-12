/**
 * テーマ管理 E2Eテスト（デスクトップ）
 *
 * テスト対象:
 * 1. テーマの新規作成フロー（作成→一覧反映→テーマバー表示）
 * 2. テーマ切替によるカレンダー記念日表示の絞り込み
 * 3. 推し編集モーダルからの所属テーマ変更
 * 4. テーマの削除（推し本体は残ること）
 * 5. 旧「所属グループ」からのテーマ自動移行
 *
 * モバイルでは管理UIが異なるため、デスクトップのみで実行。
 */
import { test, expect } from '@playwright/test';

/** 推しのテスト用データ（記念日は 2024-01 に集中させて1ヶ月表示で検証する） */
const OSHI_A = {
    id: 'os_a', name: 'アリス', color: '#ff0000', tags: [], group: '',
    memorial_dates: [{ type_id: 'bday', date: '1/10', is_annual: true }],
};
const OSHI_B = {
    id: 'os_b', name: 'ボブ', color: '#00ff00', tags: [], group: '',
    memorial_dates: [{ type_id: 'bday', date: '1/20', is_annual: true }],
};

const BASE_SETTINGS = {
    startOfWeek: 0,
    monthCount: 1,
    layoutDirection: 'row',
    layoutMode: 'smart',
    immersiveMode: false,
    oshiList: [OSHI_A, OSHI_B],
    mediaMode: 'single',
    mediaPosition: 'top',
    imageCompressMode: 'standard',
    themes: [],
    activeThemeId: null,
    themesMigratedFromGroups: true,
};

/** 指定した設定でアプリを開く（リロード後に上書きしないよう空の場合のみ投入する） */
async function openApp(page, settings) {
    await page.clock.install({ time: new Date('2024-01-01T00:00:00Z') });
    await page.addInitScript((s) => {
        if (!window.localStorage.getItem('oshikoyo_settings')) {
            window.localStorage.setItem('oshikoyo_settings', JSON.stringify(s));
        }
        // デフォルト画像の自動投入を抑止し、IndexedDB のキー採番をテスト側で確定させる
        window.localStorage.setItem('oshikoyo_seeded', '1');
    }, settings);
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
}

/** 設定モーダル→推し管理モーダル→テーマ管理モーダルを開く */
async function openThemeManager(page) {
    await page.locator('#btnSettings').click();
    await expect(page.locator('#settingsModal')).toBeVisible();
    await page.locator('#btnOpenOshiManager').click();
    await expect(page.locator('#oshiManagementModal')).toBeVisible();
    await page.locator('#btnOpenThemeManager').click();
    await expect(page.locator('#themeManagerModal')).toBeVisible();
}

/** IndexedDB に既知サイズのダミー画像を投入する（キーは 1,2,3... の自動採番） */
async function seedImages(page, count) {
    await page.evaluate(async (n) => {
        const db = await new Promise((resolve, reject) => {
            const req = indexedDB.open('OshikoyoDB', 1);
            req.onupgradeneeded = (e) => {
                const d = e.target.result;
                if (!d.objectStoreNames.contains('images')) d.createObjectStore('images', { autoIncrement: true });
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
        await new Promise((resolve, reject) => {
            const tx = db.transaction('images', 'readwrite');
            const store = tx.objectStore('images');
            for (let i = 0; i < n; i++) {
                const bytes = new Uint8Array(1024 * (i + 1));
                store.add(new File([bytes], `img${i + 1}.png`, { type: 'image/png' }));
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    }, count);
}

test.describe('テーマ管理', () => {
    test.beforeEach(async ({ isMobile }, testInfo) => {
        if (isMobile) testInfo.skip();
    });

    // ----------------------------------------------------------
    // テーマ作成
    // ----------------------------------------------------------
    test('テーマ作成: 未登録時は空状態が表示されること', async ({ page }) => {
        await openApp(page, BASE_SETTINGS);
        await openThemeManager(page);

        await expect(page.locator('#themeManagerEmpty')).toBeVisible();
        await expect(page.locator('#themeManagerEmpty')).toContainText('まだテーマがありません');
    });

    test('テーマ作成: 名前と所属推しを指定して保存すると一覧に反映されること', async ({ page }) => {
        await openApp(page, BASE_SETTINGS);
        await openThemeManager(page);

        await page.locator('#btnThemeCreate').click();
        await expect(page.locator('#themeEditModal')).toBeVisible();
        await expect(page.locator('#themeEditTitle')).toHaveText('テーマを新規作成');

        await page.locator('#themeEditName').fill('推しグループ1');
        // アリスのみを所属させる
        await page.locator('#themeEditOshiList input[type="checkbox"]').first().check();
        await page.locator('#btnThemeEditSave').click();

        await expect(page.locator('#themeEditModal')).not.toBeVisible();
        await expect(page.locator('#themeManagerList')).toContainText('推しグループ1');
        await expect(page.locator('#themeManagerList')).toContainText('1人');
    });

    test('テーマ作成: 名前が空のまま保存するとエラートーストが出て閉じないこと', async ({ page }) => {
        await openApp(page, BASE_SETTINGS);
        await openThemeManager(page);

        await page.locator('#btnThemeCreate').click();
        await page.locator('#btnThemeEditSave').click();

        await expect(page.locator('#themeEditModal')).toBeVisible();
        await expect(page.locator('.toast-message')).toBeVisible({ timeout: 3000 });
    });

    test('テーマ作成: 同名テーマは作成できないこと', async ({ page }) => {
        await openApp(page, {
            ...BASE_SETTINGS,
            themes: [{ id: 'th1', name: '既存テーマ', color: '#f472b6', oshiIds: ['os_a'] }],
        });
        await openThemeManager(page);

        await page.locator('#btnThemeCreate').click();
        await page.locator('#themeEditName').fill('既存テーマ');
        await page.locator('#btnThemeEditSave').click();

        await expect(page.locator('#themeEditModal')).toBeVisible();
        await expect(page.locator('.toast-message')).toContainText('同じ名前のテーマ');
    });

    // ----------------------------------------------------------
    // テーマバーによる絞り込み
    // ----------------------------------------------------------
    test('テーマバー: テーマ登録時にチップが表示されること', async ({ page }) => {
        await openApp(page, {
            ...BASE_SETTINGS,
            themes: [{ id: 'th1', name: 'チームA', color: '#f472b6', oshiIds: ['os_a'] }],
        });

        const bar = page.locator('#focusFilterBar');
        await expect(bar).toBeVisible();
        await expect(bar).toContainText('すべて');
        await expect(bar).toContainText('チームA');
    });

    test('テーマバー: テーマ未登録ならバーは非表示のままであること', async ({ page }) => {
        await openApp(page, BASE_SETTINGS);
        await expect(page.locator('#focusFilterBar')).not.toBeVisible();
    });

    test('テーマ切替: 選択したテーマの推しのみカレンダーに表示されること', async ({ page }) => {
        await openApp(page, {
            ...BASE_SETTINGS,
            themes: [{ id: 'th1', name: 'チームA', color: '#f472b6', oshiIds: ['os_a'] }],
        });

        // 初期状態（すべて）では両方表示
        const wrapper = page.locator('#calendarWrapper');
        await expect(wrapper).toContainText('アリス');
        await expect(wrapper).toContainText('ボブ');

        // テーマを選択するとテーマ外の推しが消える
        await page.locator('#focusFilterBar button', { hasText: 'チームA' }).click();
        await expect(wrapper).toContainText('アリス');
        await expect(wrapper).not.toContainText('ボブ');

        // 「すべて」に戻すと再び両方表示される
        await page.locator('#focusFilterBar button', { hasText: 'すべて' }).click();
        await expect(wrapper).toContainText('ボブ');
    });

    test('テーマ切替: 選択状態がリロード後も保持されること', async ({ page }) => {
        await openApp(page, {
            ...BASE_SETTINGS,
            themes: [{ id: 'th1', name: 'チームA', color: '#f472b6', oshiIds: ['os_a'] }],
        });

        await page.locator('#focusFilterBar button', { hasText: 'チームA' }).click();
        await expect(page.locator('#calendarWrapper')).not.toContainText('ボブ');

        await page.reload();
        await page.waitForLoadState('networkidle');

        await expect(page.locator('#focusFilterBar button.active')).toHaveText('チームA');
        await expect(page.locator('#calendarWrapper')).not.toContainText('ボブ');
    });

    // ----------------------------------------------------------
    // 推し編集モーダルからの所属変更
    // ----------------------------------------------------------
    test('推し編集: 所属テーマのチェックを変更すると絞り込みに反映されること', async ({ page }) => {
        await openApp(page, {
            ...BASE_SETTINGS,
            themes: [{ id: 'th1', name: 'チームA', color: '#f472b6', oshiIds: ['os_a'] }],
            activeThemeId: 'th1',
        });

        // テーマ選択中なのでボブは非表示
        await expect(page.locator('#calendarWrapper')).not.toContainText('ボブ');

        // ボブの編集画面を開いてチームAにチェックを入れる
        await page.locator('#btnSettings').click();
        await page.locator('#btnOpenOshiManager').click();
        await page.locator('#oshiTableBody tr', { hasText: 'ボブ' })
            .locator('button[aria-label="推しの編集"]').click();
        await expect(page.locator('#oshiEditModal')).toBeVisible();

        const themeCheck = page.locator('#oshiEditThemes input[type="checkbox"]');
        await expect(themeCheck).toHaveCount(1);
        await expect(themeCheck).not.toBeChecked();
        await themeCheck.check();
        await page.locator('#btnOshiEditSave').click();

        await page.locator('#btnCloseOshiManager').click();
        await page.locator('#btnClose').click();

        await expect(page.locator('#calendarWrapper')).toContainText('ボブ');
    });

    test('推し編集: テーマ未登録時は案内文が表示されること', async ({ page }) => {
        await openApp(page, BASE_SETTINGS);

        await page.locator('#btnSettings').click();
        await page.locator('#btnOpenOshiManager').click();
        await page.locator('#btnOshiAddTop').click();
        await expect(page.locator('#oshiEditModal')).toBeVisible();

        await expect(page.locator('#oshiEditThemesEmpty')).toBeVisible();
        await expect(page.locator('#oshiEditThemes input[type="checkbox"]')).toHaveCount(0);
    });

    // ----------------------------------------------------------
    // テーマ削除
    // ----------------------------------------------------------
    test('テーマ削除: テーマのみ削除され推しは残ること', async ({ page }) => {
        await openApp(page, {
            ...BASE_SETTINGS,
            themes: [{ id: 'th1', name: '削除対象', color: '#f472b6', oshiIds: ['os_a'] }],
        });
        await openThemeManager(page);

        await page.locator('.theme-row', { hasText: '削除対象' })
            .locator('button[aria-label*="削除"]').click();
        await page.locator('.confirm-dialog button', { hasText: '削除する' }).click();

        await expect(page.locator('#themeManagerList')).not.toContainText('削除対象');
        await expect(page.locator('#themeManagerEmpty')).toBeVisible();

        // 推し本体は残っている
        await page.locator('#btnCloseThemeManager').click();
        await expect(page.locator('#oshiTableBody')).toContainText('アリス');
    });

    // ----------------------------------------------------------
    // 旧グループからの移行
    // ----------------------------------------------------------
    test('移行: 旧「所属グループ」から初回起動時にテーマが自動生成されること', async ({ page }) => {
        await openApp(page, {
            ...BASE_SETTINGS,
            oshiList: [
                { ...OSHI_A, group: 'グループA' },
                { ...OSHI_B, group: 'グループB' },
            ],
            themes: undefined,
            themesMigratedFromGroups: undefined,
        });

        const bar = page.locator('#focusFilterBar');
        await expect(bar).toBeVisible();
        await expect(bar).toContainText('グループA');
        await expect(bar).toContainText('グループB');
    });

    test('移行: 旧フォーカスモードの選択状態がテーマ選択に引き継がれること', async ({ page }) => {
        await openApp(page, {
            ...BASE_SETTINGS,
            oshiList: [
                { ...OSHI_A, group: 'グループA' },
                { ...OSHI_B, group: 'グループB' },
            ],
            activeFilter: 'グループA',
            themes: undefined,
            themesMigratedFromGroups: undefined,
        });

        await expect(page.locator('#focusFilterBar button.active')).toHaveText('グループA');
        await expect(page.locator('#calendarWrapper')).not.toContainText('ボブ');
    });
    // ----------------------------------------------------------
    // 容量表示・デタッチ（端末から降ろす）
    // ----------------------------------------------------------
    test('容量表示: テーマごとの画像枚数と専有容量が表示されること', async ({ page }) => {
        await openApp(page, {
            ...BASE_SETTINGS,
            themes: [
                { id: 'th1', name: 'チームA', color: '#f472b6', oshiIds: ['os_a'] },
                { id: 'th2', name: 'チームB', color: '#60a5fa', oshiIds: ['os_b'] },
            ],
            localImageOrder: [1, 2, 3],
            localImageMeta: {
                1: { tags: ['アリス'] },            // チームA 専有
                2: { tags: ['ボブ'] },              // チームB 専有
                3: { tags: ['アリス', 'ボブ'] },    // 両テーマで共有
            },
        });
        await seedImages(page, 3);
        await page.reload();
        await page.waitForLoadState('networkidle');
        await openThemeManager(page);

        const rowA = page.locator('.theme-row', { hasText: 'チームA' });
        // 一致は画像1と画像3の2枚、うち専有は画像1のみ
        await expect(rowA.locator('.theme-row__storage')).toContainText('画像2枚');
        await expect(rowA.locator('.theme-row__storage')).toContainText('専有');
    });

    test('容量表示: 専有画像がないテーマは「降ろす」が無効化されること', async ({ page }) => {
        await openApp(page, {
            ...BASE_SETTINGS,
            themes: [
                { id: 'th1', name: 'チームA', color: '#f472b6', oshiIds: ['os_a'] },
                { id: 'th2', name: 'チームB', color: '#60a5fa', oshiIds: ['os_b'] },
            ],
            localImageOrder: [1],
            localImageMeta: { 1: { tags: ['アリス', 'ボブ'] } },  // 両テーマで共有のみ
        });
        await seedImages(page, 1);
        await page.reload();
        await page.waitForLoadState('networkidle');
        await openThemeManager(page);

        const rowA = page.locator('.theme-row', { hasText: 'チームA' });
        await expect(rowA.locator('.theme-row__storage')).toContainText('すべて共有');
        await expect(rowA.locator('.theme-row__detach')).toBeDisabled();
    });

    test('デタッチ: 書き出し後に専有画像のみ削除され共有画像は残ること', async ({ page }) => {
        await openApp(page, {
            ...BASE_SETTINGS,
            themes: [
                { id: 'th1', name: 'チームA', color: '#f472b6', oshiIds: ['os_a'] },
                { id: 'th2', name: 'チームB', color: '#60a5fa', oshiIds: ['os_b'] },
            ],
            localImageOrder: [1, 2, 3],
            localImageMeta: {
                1: { tags: ['アリス'] },            // チームA 専有 → 削除対象
                2: { tags: ['ボブ'] },              // チームB 専有 → 残る
                3: { tags: ['アリス', 'ボブ'] },    // 共有 → 残る
            },
        });
        await seedImages(page, 3);
        await page.reload();
        await page.waitForLoadState('networkidle');
        await openThemeManager(page);

        const rowA = page.locator('.theme-row', { hasText: 'チームA' });
        await expect(rowA.locator('.theme-row__detach')).toBeEnabled();

        const downloadPromise = page.waitForEvent('download');
        await rowA.locator('.theme-row__detach').click();
        await page.locator('.confirm-dialog button', { hasText: '書き出して降ろす' }).click();

        // 画像込みパッケージが書き出されること
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/^oshikoyo_theme_.*\.json\.gz$/);

        // 専有画像（キー1）のみが削除されること
        await expect.poll(async () => await page.evaluate(async () => {
            const db = await new Promise((resolve) => {
                const req = indexedDB.open('OshikoyoDB', 1);
                req.onsuccess = (e) => resolve(e.target.result);
            });
            const keys = await new Promise((resolve) => {
                const req = db.transaction('images', 'readonly').objectStore('images').getAllKeys();
                req.onsuccess = () => resolve(req.result);
            });
            db.close();
            return keys;
        })).toEqual([2, 3]);

        // 設定側のメタデータからも除去されること
        const meta = await page.evaluate(() =>
            JSON.parse(window.localStorage.getItem('oshikoyo_settings')).localImageMeta);
        expect(meta['1']).toBeUndefined();
        expect(meta['3']).toBeDefined();

        // テーマと推しは残ること
        await expect(page.locator('#themeManagerList')).toContainText('チームA');
    });

    test('デタッチ: 確認ダイアログでキャンセルすると画像が削除されないこと', async ({ page }) => {
        await openApp(page, {
            ...BASE_SETTINGS,
            themes: [{ id: 'th1', name: 'チームA', color: '#f472b6', oshiIds: ['os_a'] }],
            localImageOrder: [1],
            localImageMeta: { 1: { tags: ['アリス'] } },
        });
        await seedImages(page, 1);
        await page.reload();
        await page.waitForLoadState('networkidle');
        await openThemeManager(page);

        const rowA = page.locator('.theme-row', { hasText: 'チームA' });
        await expect(rowA.locator('.theme-row__detach')).toBeEnabled();
        await rowA.locator('.theme-row__detach').click();
        await page.locator('.confirm-dialog button', { hasText: 'キャンセル' }).click();

        const keys = await page.evaluate(async () => {
            const db = await new Promise((resolve) => {
                const req = indexedDB.open('OshikoyoDB', 1);
                req.onsuccess = (e) => resolve(e.target.result);
            });
            const result = await new Promise((resolve) => {
                const req = db.transaction('images', 'readonly').objectStore('images').getAllKeys();
                req.onsuccess = () => resolve(req.result);
            });
            db.close();
            return result;
        });
        expect(keys).toEqual([1]);
    });
});
