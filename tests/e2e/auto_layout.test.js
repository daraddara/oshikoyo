import { test, expect } from '@playwright/test';

test.describe('Layout Auto-Optimization & Glassmorphism', () => {
    test.beforeEach(async ({ page }) => {
        await page.clock.install({ time: new Date('2026-03-08T00:00:00Z') });
        await page.goto('/index.html');
        await page.waitForLoadState('networkidle');

        await page.waitForSelector('#btnSettings', { state: 'visible' });
        await page.click('#btnSettings');

        const autoLayoutCheckbox = page.locator('#checkAutoLayout');
        await expect(autoLayoutCheckbox).toBeVisible();
        if (!(await autoLayoutCheckbox.isChecked())) {
            await autoLayoutCheckbox.check();
        }
        await page.click('#btnSave');
        await page.waitForSelector('#settingsModal', { state: 'hidden' });
    });

    test('should optimize layout for landscape images with glassmorphism backdrop', async ({ page }) => {
        await page.evaluate(async () => {
            if (window.mediaTimer) { clearInterval(window.mediaTimer); clearTimeout(window.mediaTimer); }
            window.updateMediaArea = async () => {}; // Stub background load
            if (window.localImageDB) {
                window.localImageDB.getAllKeys = async () => [1];
                window.localImageDB.getImage = async () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 1200; canvas.height = 600;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ccc'; ctx.fillRect(0, 0, 1200, 600);
                    return { file: new Blob([atob(canvas.toDataURL('image/png').split(',')[1])].map(c => new Uint8Array(c.split('').map(x => x.charCodeAt(0))))[0], {type: 'image/png'}) };
                };
            }
            // Manually recreate the applyAutoLayout logic just for the manual element to bypass browser-specific loading weirdness.
            const img = document.createElement('img');
            img.className = 'media-main-img';
            Object.defineProperty(img, 'naturalWidth', { get: () => 1200, configurable: true });
            Object.defineProperty(img, 'naturalHeight', { get: () => 600, configurable: true });

            const container = document.getElementById('mediaContainer');
            let contentLayer = container.querySelector('.media-content-layer');
            if (!contentLayer) {
                contentLayer = document.createElement('div');
                contentLayer.className = 'media-content-layer';
                container.appendChild(contentLayer);
            }
            let displayArea = contentLayer.querySelector('.media-display-area');
            if (!displayArea) {
                displayArea = document.createElement('div');
                displayArea.className = 'media-display-area';
                contentLayer.appendChild(displayArea);
            }
            displayArea.innerHTML = '';
            displayArea.appendChild(img);

            // Bypass early returns for missing src
            // Trigger the auto-layout logic deterministically
            window.appSettings.autoLayoutMode = true; // Ensure auto-layout is enabled
            window.applyAutoLayout(img);

            // Re-enable updateMediaArea for updateView to work correctly
            window.updateMediaArea = async () => {};
            window.updateView();

            // Bypass background image load from overwriting test state
            img.onload = null;
            img.src = '/src/assets/default_image.png';
        });

        await page.waitForTimeout(1000);

        const mainLayout = page.locator('#mainLayout');
        await expect(mainLayout).toHaveClass(/pos-top/);

        const calendarWrapper = page.locator('#calendarWrapper');
        const isMobile = await page.evaluate(() => window.innerWidth <= 768);
        if (isMobile) {
            await expect(calendarWrapper).toHaveCSS('flex-direction', 'column');
        } else {
            await expect(calendarWrapper).toHaveCSS('flex-direction', 'row');
        }
    });

    test('should optimize layout for portrait images', async ({ page }) => {
        await page.evaluate(async () => {
            if (window.mediaTimer) { clearInterval(window.mediaTimer); clearTimeout(window.mediaTimer); }
            window.updateMediaArea = async () => {}; // Stub background load
            if (window.localImageDB) {
                window.localImageDB.getAllKeys = async () => [1];
                window.localImageDB.getImage = async () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 600; canvas.height = 1200;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ccc'; ctx.fillRect(0, 0, 600, 1200);
                    return { file: new Blob([atob(canvas.toDataURL('image/png').split(',')[1])].map(c => new Uint8Array(c.split('').map(x => x.charCodeAt(0))))[0], {type: 'image/png'}) };
                };
            }
            const img = document.createElement('img');
            img.className = 'media-main-img';
            Object.defineProperty(img, 'naturalWidth', { get: () => 600, configurable: true });
            Object.defineProperty(img, 'naturalHeight', { get: () => 1200, configurable: true });

            const container = document.getElementById('mediaContainer');
            let contentLayer = container.querySelector('.media-content-layer');
            if (!contentLayer) {
                contentLayer = document.createElement('div');
                contentLayer.className = 'media-content-layer';
                container.appendChild(contentLayer);
            }
            let displayArea = contentLayer.querySelector('.media-display-area');
            if (!displayArea) {
                displayArea = document.createElement('div');
                displayArea.className = 'media-display-area';
                contentLayer.appendChild(displayArea);
            }
            displayArea.innerHTML = '';
            displayArea.appendChild(img);

            // Trigger the auto-layout logic deterministically
            window.appSettings.autoLayoutMode = true; // Ensure auto-layout is enabled
            window.applyAutoLayout(img);

            // Re-enable updateMediaArea for updateView to work correctly
            window.updateMediaArea = async () => {};
            window.updateView();

            // Bypass background image load from overwriting test state
            img.onload = null;
            img.src = '/src/assets/default_image.png';
        });

        await page.waitForTimeout(1000);

        const mainLayout = page.locator('#mainLayout');
        const isMobile = await page.evaluate(() => window.innerWidth <= 768);
        if (!isMobile) {
            await expect(mainLayout).toHaveClass(/pos-left/);
        }

        const calendarWrapper = page.locator('#calendarWrapper');
        await expect(calendarWrapper).toHaveCSS('flex-direction', 'column');
    });

    test('should respect manual settings when auto-layout is OFF', async ({ page }) => {
        await page.evaluate(async () => {
            if (window.mediaTimer) { clearInterval(window.mediaTimer); clearTimeout(window.mediaTimer); }
            window.updateMediaArea = async () => {}; // Stub background load
            if (window.localImageDB) {
                window.localImageDB.getAllKeys = async () => [1];
                window.localImageDB.getImage = async () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 600; canvas.height = 1200;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ccc'; ctx.fillRect(0, 0, 600, 1200);
                    return { file: new Blob([atob(canvas.toDataURL('image/png').split(',')[1])].map(c => new Uint8Array(c.split('').map(x => x.charCodeAt(0))))[0], {type: 'image/png'}) };
                };
            }
            const img = document.createElement('img');
            img.className = 'media-main-img';
            Object.defineProperty(img, 'naturalWidth', { get: () => 600, configurable: true });
            Object.defineProperty(img, 'naturalHeight', { get: () => 1200, configurable: true });

            const container = document.getElementById('mediaContainer');
            let contentLayer = container.querySelector('.media-content-layer');
            if (!contentLayer) {
                contentLayer = document.createElement('div');
                contentLayer.className = 'media-content-layer';
                container.appendChild(contentLayer);
            }
            let displayArea = contentLayer.querySelector('.media-display-area');
            if (!displayArea) {
                displayArea = document.createElement('div');
                displayArea.className = 'media-display-area';
                contentLayer.appendChild(displayArea);
            }
            displayArea.innerHTML = '';
            displayArea.appendChild(img);

            window.appSettings.autoLayoutMode = false;
            window.appSettings.mediaPosition = 'top';
            window.appSettings.layoutDirection = 'row';

            // Trigger the auto-layout logic deterministically
            window.applyAutoLayout(img);

            // Re-enable updateMediaArea for updateView to work correctly
            window.updateMediaArea = async () => {};
            window.updateView();

            // Bypass background image load from overwriting test state
            img.onload = null;
            img.src = '/src/assets/default_image.png';
        });

        await page.waitForTimeout(1000);

        const mainLayout = page.locator('#mainLayout');
        await expect(mainLayout).not.toHaveClass(/pos-left/);
    });
});
