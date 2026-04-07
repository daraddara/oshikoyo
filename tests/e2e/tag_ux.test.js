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
        
        // 設定モーダルを開く
        await page.locator('#btnSettings').click();
        await page.locator('.settings-tab-btn[data-tab="media"]').click();

        // ファイル入力をトリガー
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.locator('#btnLocalFiles').click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(filePath);

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

    test('1回登録後、次の登録時に履歴チップが表示され、クリックで追加できること', async ({ page }) => {
        const filePath = path.join(__dirname, '../fixtures/images/test_square.png');

        // 1回目：設定モーダル経由で追加
        await page.locator('#btnSettings').click();
        await page.locator('.settings-tab-btn[data-tab="media"]').click();

        const fileChooserPromise1 = page.waitForEvent('filechooser');
        await page.locator('#btnLocalFiles').click();
        const fileChooser1 = await fileChooserPromise1;
        await fileChooser1.setFiles(filePath);
        await expect(page.locator('#previewModal')).toBeVisible({ timeout: 10000 });
        
        const input = page.locator('#previewTagInputArea input');
        await input.fill('テストタグ');
        await page.keyboard.press('Enter');
        
        await page.locator('#btnAddPreview').click();
        await expect(page.locator('#previewModal')).not.toBeVisible();

        // 2回目：再度登録プロセスを開始（設定モーダルは開いたままのはずだが念のため確認）
        if (!await page.locator('#settingsModal').isVisible()) {
            await page.locator('#btnSettings').click();
            await page.locator('.settings-tab-btn[data-tab="media"]').click();
        }

        const fileChooserPromise2 = page.waitForEvent('filechooser');
        await page.locator('#btnLocalFiles').click();
        const fileChooser2 = await fileChooserPromise2;
        await fileChooser2.setFiles(filePath);
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
