import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Tag UX Improvements', () => {
    test.beforeEach(async ({ page }) => {
        // コンソールエラーをキャッチ
        page.on('console', msg => {
            if (msg.type() === 'error') console.log(`BROWSER ERROR: ${msg.text()}`);
            else console.log(`BROWSER LOG: ${msg.text()}`);
        });
        // スクリーンショットの安定化のため時刻を固定
        await page.clock.install({ time: new Date('2024-01-01T00:00:00Z') });
        await page.goto('http://localhost:8081/index.html');
    });

    test('画像登録プレビューでラベルが「タグ（任意）」であり、初期状態が空であること', async ({ page }) => {
        const filePath = path.join(__dirname, '../fixtures/images/test_square.png');
        
        const isMobileUI = await page.evaluate(() => window.isMobile());

        // 設定を開き、メディア（画像）タブを選択する
        if (isMobileUI) {
            await page.locator('.mobile-tab-btn[data-tab="settings"]').tap();
            await page.locator('.settings-menu-item[data-panel="media"]').tap();
            await expect(page.locator('#mobileSubPanel-media')).toHaveClass(/is-open/, { timeout: 3000 });
        } else {
            await page.locator('#btnSettings').click();
            await page.locator('.settings-tab-btn[data-tab="media"]').click();
        }

        // ファイル入力をトリガー（WebKitバグ回避のため input 要素に直接セット）
        await page.locator('#inputLocalFiles').setInputFiles(filePath);

        // プレビューモーダルが表示されるのを待つ
        const previewModal = page.locator('#previewModal');
        await expect(previewModal).toBeVisible({ timeout: 10000 });

        // ラベルの確認
        const label = previewModal.locator('#previewTagGroup label');
        await expect(label).toHaveText('タグ（任意）');

        // タグ入力欄が空であることを確認（.tag-badge が存在しない）
        const tags = previewModal.locator('#previewTagInputArea .tag-badge');
        await expect(tags).toHaveCount(0);

        // 画面キャプチャ（エビデンス用）
        await expect(page).toHaveScreenshot('tag-ux-v1-initial.png');
    });

    test('1回登録後、次の登録時に履歴チップが表示され、クリックで追加できること', async ({ page, browserName }) => {
        // Playwright WebKit: setInputFiles() が作成する Proxy File を IndexedDB に保存すると
        // DataCloneError/UnknownError が発生する既知の制約があるためスキップ。実 Safari では動作する。
        if (browserName === 'webkit') {
            test.skip(true, 'Playwright WebKit: setInputFiles() の Proxy File が IndexedDB に保存できないためスキップ');
        }

        const filePath = path.join(__dirname, '../fixtures/images/test_square.png');

        const isMobileUI = await page.evaluate(() => window.isMobile());

        // 1回目：設定モーダル経由で追加
        if (isMobileUI) {
            await page.locator('.mobile-tab-btn[data-tab="settings"]').tap();
            await page.locator('.settings-menu-item[data-panel="media"]').tap();
            await expect(page.locator('#mobileSubPanel-media')).toHaveClass(/is-open/, { timeout: 3000 });
        } else {
            await page.locator('#btnSettings').click();
            await page.locator('.settings-tab-btn[data-tab="media"]').click();
        }

        await page.locator('#inputLocalFiles').setInputFiles(filePath);
        await expect(page.locator('#previewModal')).toBeVisible({ timeout: 10000 });
        
        const input = page.locator('#previewTagInputArea input');
        await input.fill('テストタグ');
        await page.keyboard.press('Enter');
        
        await page.locator('#btnAddPreview').click({ force: true });
        await expect(page.locator('#previewModal')).not.toBeVisible();

        // 非同期保存完了を待つ（DOM更新待機: updateLocalMediaUI の発火を確認）
        await page.waitForFunction(
            () => {
                const el = document.getElementById('localImageCount');
                return el && parseInt(el.textContent || '0', 10) >= 1;
            },
            null, { timeout: 15000 }
        );

        // Tablet + WebKit 等でダイアログ・モーダル周りの状態が不安定になるのを防ぐため、明示的に待つ
        await page.waitForTimeout(500);

        // 2回目：再度登録プロセスを開始
        if (isMobileUI) {
            if (!(await page.locator('#mobileSubPanel-media').evaluate(el => el.classList.contains('is-open')))) {
                await page.locator('.mobile-tab-btn[data-tab="settings"]').tap();
                await page.locator('.settings-menu-item[data-panel="media"]').tap();
            }
        } else {
            if (!await page.locator('#settingsModal').isVisible()) {
                await page.locator('#btnSettings').click();
                await page.locator('.settings-tab-btn[data-tab="media"]').click();
            }
        }

        await page.locator('#inputLocalFiles').setInputFiles(filePath);
        await expect(page.locator('#previewModal')).toBeVisible({ timeout: 10000 });

        // 履歴チップ領域の確認
        const suggestions = page.locator('#previewTagSuggestions');
        await expect(suggestions).toContainText('前回のタグ:');
        
        const chip = suggestions.locator('.suggest-chip');
        await expect(chip).toHaveText('テストタグ');

        // 画面キャプチャ（サジェスト表示時）
        await expect(page).toHaveScreenshot('tag-ux-v1-suggestion.png');

        // チップをクリックして反映
        await chip.click();

        // タグ入力欄にバッジとして反映されたことを確認
        const badge = page.locator('#previewTagInputArea .tag-badge');
        await expect(badge).toContainText('テストタグ');

        // 画面キャプチャ（反映後）
        await expect(page).toHaveScreenshot('tag-ux-v1-reflected.png');
    });
});
