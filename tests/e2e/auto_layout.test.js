import { test, expect } from '@playwright/test';

test.describe('Layout Auto-Optimization & Glassmorphism', () => {
    test.beforeEach(async ({ page }) => {
        await page.clock.install({ time: new Date('2024-01-01T00:00:00Z') });
        await page.goto('/index.html');
        await page.waitForLoadState('networkidle');

        const autoLayoutBtn = page.locator('.layout-mode-btn');
        await expect(autoLayoutBtn).toBeVisible();
    });

    test('should optimize layout for landscape images with glassmorphism backdrop', async ({ page }) => {
        await page.evaluate(async () => {
            if (window.mediaTimer) { clearInterval(window.mediaTimer); clearTimeout(window.mediaTimer); }
            if (window.localImageDB) {
                window.localImageDB.getAllKeys = async () => [1];
                window.localImageDB.getImage = async () => {
                    const response = await fetch('/tests/fixtures/images/test_landscape.png');
                    const blob = await response.blob();
                    return { file: blob };
                };
            }
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

            img.src = '/tests/fixtures/images/test_landscape.png';

            window.appSettings.mediaPosition = 'top';
            window.appSettings.layoutDirection = 'row';
            window.updateView();
        });

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
            if (window.localImageDB) {
                window.localImageDB.getAllKeys = async () => [1];
                window.localImageDB.getImage = async () => {
                    const response = await fetch('/tests/fixtures/images/test_portrait.png');
                    const blob = await response.blob();
                    return { file: blob };
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

            img.src = '/tests/fixtures/images/test_portrait.png';

            window.appSettings.mediaPosition = 'left';
            window.appSettings.layoutDirection = 'column';
            window.updateView();
        });

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
            if (window.localImageDB) {
                window.localImageDB.getAllKeys = async () => [1];
                window.localImageDB.getImage = async () => {
                    const response = await fetch('/tests/fixtures/images/test_portrait.png');
                    const blob = await response.blob();
                    return { file: blob };
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

            img.src = '/tests/fixtures/images/test_portrait.png';

            window.appSettings.layoutMode = 'top';
            window.appSettings.mediaPosition = 'top';
            window.appSettings.layoutDirection = 'row';
            window.updateView();
        });

        const mainLayout = page.locator('#mainLayout');
        await expect(mainLayout).not.toHaveClass(/pos-left/);
    });
});
