import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../test-config.js';
import path from 'path';

test.describe('Layout Auto-Optimization & Glassmorphism', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('networkidle');

        // Ensure auto layout is ON
        await page.waitForSelector('#btnSettings', { state: 'visible' });
        await page.click('#btnSettings');

        const autoLayoutCheckbox = page.locator('#checkAutoLayout');
        await expect(autoLayoutCheckbox).toBeVisible();

        if (!(await autoLayoutCheckbox.isChecked())) {
            await autoLayoutCheckbox.check();
        }
        await page.click('#btnSave');
        // Wait for modal to be fully closed
        await page.waitForSelector('#settingsModal', { state: 'hidden' });
    });

    test('should optimize layout for landscape images with glassmorphism backdrop', async ({ page }) => {
        // Direct injection: Setup mock landscape image and trigger auto-layout directly
        await page.evaluate(() => {
            const img = document.createElement('img');
            img.className = 'media-main-img';
            img.src = '/src/assets/default_image.png'; // Use existing asset for src

            // Mock dimensions for Landscape (w: 1200, h: 600 -> ratio 2.0)
            Object.defineProperty(img, 'naturalWidth', { get: () => 1200 });
            Object.defineProperty(img, 'naturalHeight', { get: () => 600 });

            // Setup DOM environment expected by layout logic
            const displayArea = document.getElementById('displayArea');
            if (displayArea) {
                displayArea.innerHTML = '';
                const backdrop = document.createElement('img');
                backdrop.className = 'media-backdrop';
                backdrop.src = img.src;
                displayArea.appendChild(backdrop);
                displayArea.appendChild(img);
            }

            // Force app state
            window.appSettings.mediaMode = 'local';

            // Execute the logic we're testing
            window.applyAutoLayout(img);
        });

        // Wait a bit for UI to react
        await page.waitForTimeout(500);

        // Check if layout class 'pos-top' is applied to #mainLayout
        const mainLayout = page.locator('#mainLayout');
        await expect(mainLayout).toHaveClass(/pos-top/);

        // Verify calendar direction (row or column for mobile)
        const calendarWrapper = page.locator('#calendarWrapper');
        const isMobile = await page.evaluate(() => window.innerWidth <= 768);
        if (isMobile) {
            await expect(calendarWrapper).toHaveCSS('flex-direction', 'column');
        } else {
            await expect(calendarWrapper).toHaveCSS('flex-direction', 'row');
        }

        // Ensure the layout update function triggers properly and check if backdrop exists
        // Given we mock, we check if the DOM manipulation actually preserved the elements
        const mainImg = page.locator('.media-main-img').first();
        await expect(mainImg).toBeAttached();

        const backdrop = page.locator('.media-backdrop').first();
        await expect(backdrop).toBeAttached();

        await expect(page).toHaveScreenshot('landscape_auto_layout.png');
    });

    test('should optimize layout for portrait images', async ({ page }) => {
        // Direct injection: Setup mock portrait image and trigger auto-layout directly
        await page.evaluate(() => {
            const img = document.createElement('img');
            img.className = 'media-main-img';
            img.src = '/src/assets/default_image.png';

            // Mock dimensions for Portrait (w: 600, h: 1200 -> ratio 0.5)
            Object.defineProperty(img, 'naturalWidth', { get: () => 600 });
            Object.defineProperty(img, 'naturalHeight', { get: () => 1200 });

            // Setup DOM environment expected by layout logic
            const displayArea = document.getElementById('displayArea');
            if (displayArea) {
                displayArea.innerHTML = '';
                const backdrop = document.createElement('img');
                backdrop.className = 'media-backdrop';
                backdrop.src = img.src;
                displayArea.appendChild(backdrop);
                displayArea.appendChild(img);
            }

            // Force app state
            window.appSettings.mediaMode = 'local';

            // Execute the logic we're testing
            window.applyAutoLayout(img);
        });

        // Wait for layout adjustment
        await page.waitForTimeout(500);

        // Check if layout class 'pos-left' is applied
        const mainLayout = page.locator('#mainLayout');
        const isMobile = await page.evaluate(() => window.innerWidth <= 768);
        if (!isMobile) {
            await expect(mainLayout).toHaveClass(/pos-left/);
        }

        // Verify calendar direction (column)
        const calendarWrapper = page.locator('#calendarWrapper');
        await expect(calendarWrapper).toHaveCSS('flex-direction', 'column');

        await expect(page).toHaveScreenshot('portrait_auto_layout.png');
    });

    test('should respect manual settings when auto-layout is OFF', async ({ page }) => {
        // Direct injection: Setup mock portrait image but with auto-layout OFF
        await page.evaluate(() => {
            window.appSettings.autoLayoutMode = false;
            window.appSettings.mediaPosition = 'top'; // Ensure initial state is different from what portrait would force
            window.appSettings.layoutDirection = 'row';

            const img = document.createElement('img');
            img.className = 'media-main-img';
            img.src = '/src/assets/default_image.png';

            // Mock dimensions for Portrait (which normally triggers 'pos-left')
            Object.defineProperty(img, 'naturalWidth', { get: () => 600 });
            Object.defineProperty(img, 'naturalHeight', { get: () => 1200 });

            // Execute the logic we're testing
            window.applyAutoLayout(img);
        });

        // Wait a bit to ensure NO auto-change happens
        await page.waitForTimeout(500);

        // It should NOT be 'pos-left' if it wasn't already
        const mainLayout = page.locator('#mainLayout');
        await expect(mainLayout).not.toHaveClass(/pos-left/);
    });
});
