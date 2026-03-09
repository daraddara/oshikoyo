import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../test-config.js';
import path from 'path';

test.describe('Layout Auto-Optimization & Glassmorphism', () => {
    test.beforeEach(async ({ page }) => {
        // Date Mocking
        await page.clock.install({ time: new Date('2026-03-08T00:00:00Z') });

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
        // Mock naturalWidth/Height for Landscape trigger (ratio >= 1.2)
        await page.addScriptTag({
            content: `
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            if (node.classList && node.classList.contains('media-main-img')) {
                                Object.defineProperty(node, 'naturalWidth', { get: () => 1200 });
                                Object.defineProperty(node, 'naturalHeight', { get: () => 600 });
                                node.dispatchEvent(new Event('load'));
                            }
                        });
                    });
                });
                observer.observe(document.body, { childList: true, subtree: true });
            `
        });

        // Open Settings
        await page.click('#btnSettings');
        await page.waitForSelector('#settingsModal', { state: 'visible' });

        // Upload landscape image
        const filePath = path.resolve(__dirname, '../fixtures/images/test_landscape.png');
        await page.setInputFiles('#inputLocalFiles', filePath);

        // Close Settings Modal (This triggers refresh in current main)
        await page.click('#btnSave');
        await page.waitForSelector('#settingsModal', { state: 'hidden' });

        // Wait for image container content to be updated
        const mainImg = page.locator('.media-main-img');
        await expect(mainImg).toBeVisible({ timeout: TEST_CONFIG.timeouts.medium });

        // Check if layout class 'pos-top' is applied to #mainLayout
        const mainLayout = page.locator('#mainLayout');
        await expect(mainLayout).toHaveClass(/pos-top/);

        // Verify calendar direction (row)
        const calendarWrapper = page.locator('#calendarWrapper');
        await expect(calendarWrapper).toHaveCSS('flex-direction', 'row');

        // Verify Glassmorphism layers
        const backdrop = page.locator('.media-backdrop');
        await expect(backdrop).toBeVisible();
        await expect(mainImg).toBeVisible();

        // Check blur style
        const backdropBlur = await backdrop.evaluate(el => window.getComputedStyle(el).filter);
        expect(backdropBlur).toContain('blur(25px)');

        await expect(page).toHaveScreenshot('landscape_auto_layout.png');
    });

    test('should optimize layout for portrait images', async ({ page }) => {
        // Mock naturalWidth/Height for Portrait trigger
        await page.addScriptTag({
            content: `
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            if (node.classList && node.classList.contains('media-main-img')) {
                                Object.defineProperty(node, 'naturalWidth', { get: () => 600 });
                                Object.defineProperty(node, 'naturalHeight', { get: () => 1200 });
                                node.dispatchEvent(new Event('load'));
                            }
                        });
                    });
                });
                observer.observe(document.body, { childList: true, subtree: true });
            `
        });

        // Open Settings
        await page.click('#btnSettings');
        await page.waitForSelector('#settingsModal', { state: 'visible' });

        // Upload portrait image
        const filePath = path.resolve(__dirname, '../fixtures/images/test_portrait.png');
        await page.setInputFiles('#inputLocalFiles', filePath);

        // Close Settings Modal
        await page.click('#btnSave');
        await page.waitForSelector('#settingsModal', { state: 'hidden' });

        // Wait for layout adjustment
        const mainImg = page.locator('.media-main-img');
        await expect(mainImg).toBeVisible({ timeout: TEST_CONFIG.timeouts.medium });

        // Check if layout class 'pos-left' is applied
        const mainLayout = page.locator('#mainLayout');
        await expect(mainLayout).toHaveClass(/pos-left/);

        // Verify calendar direction (column)
        const calendarWrapper = page.locator('#calendarWrapper');
        await expect(calendarWrapper).toHaveCSS('flex-direction', 'column');

        await expect(page).toHaveScreenshot('portrait_auto_layout.png');
    });

    test('should respect manual settings when auto-layout is OFF', async ({ page }) => {
        // Disable auto layout
        await page.click('#btnSettings');
        await page.waitForSelector('#settingsModal', { state: 'visible' });

        const autoLayoutCheckbox = page.locator('#checkAutoLayout');
        await autoLayoutCheckbox.uncheck();
        await page.click('#btnSave');
        await page.waitForSelector('#settingsModal', { state: 'hidden' });

        const mainLayout = page.locator('#mainLayout');

        // Upload portrait image (which would normally trigger 'pos-left')
        await page.click('#btnSettings');
        await page.waitForSelector('#settingsModal', { state: 'visible' });
        const filePath = path.resolve(__dirname, '../fixtures/images/test_portrait.png');
        await page.setInputFiles('#inputLocalFiles', filePath);

        await page.click('#btnSave');
        await page.waitForSelector('#settingsModal', { state: 'hidden' });

        // Wait for image to appear
        const mainImg = page.locator('.media-main-img');
        await expect(mainImg).toBeVisible({ timeout: TEST_CONFIG.timeouts.medium });

        // It should NOT be 'pos-left' if it wasn't already
        await expect(mainLayout).not.toHaveClass(/pos-left/);
    });
});
