import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Layout Auto-Optimization & Glassmorphism', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8081/index.html');
        // Ensure auto layout is ON
        await page.click('#btnSettings');
        const autoLayoutCheckbox = page.locator('#checkAutoLayout');
        if (!(await autoLayoutCheckbox.isChecked())) {
            await autoLayoutCheckbox.check();
        }
        await page.click('#btnSave');
        // Wait for modal to be fully ready
        await page.waitForTimeout(500);
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
                                // Dispatch load event to trigger the application logic
                                node.dispatchEvent(new Event('load'));
                            }
                        });
                    });
                });
                observer.observe(document.body, { childList: true, subtree: true });
            `
        });

        // Upload landscape image
        const filePath = path.resolve(__dirname, '../fixtures/images/test_landscape.png');
        await page.setInputFiles('#inputLocalFiles', filePath);
        await page.click('#btnSave');

        // Wait for image container content to be updated
        await page.waitForSelector('.media-main-img', { timeout: 10000 });

        // Wait a bit for the onload logic to settle
        await page.waitForTimeout(500);

        // Check if layout class 'pos-top' is applied to #mainLayout
        const mainLayout = page.locator('#mainLayout');
        await expect(mainLayout).toHaveClass(/pos-top/);

        // Verify calendar direction (row)
        const calendarWrapper = page.locator('#calendarWrapper');
        await expect(calendarWrapper).toHaveCSS('flex-direction', 'row');

        // Verify Glassmorphism layers
        const backdrop = page.locator('.media-backdrop');
        const mainImg = page.locator('.media-main-img');
        await expect(backdrop).toBeVisible();
        await expect(mainImg).toBeVisible();

        // Check blur style
        const backdropBlur = await backdrop.evaluate(el => window.getComputedStyle(el).filter);
        expect(backdropBlur).toContain('blur(25px)');

        await page.screenshot({ path: 'tests/e2e/screenshots/landscape_auto_layout.png', fullPage: true });
    });

    test('should optimize layout for portrait images', async ({ page }) => {
        // Mock naturalWidth/Height for Portrait trigger (ratio <= 0.83...)
        await page.addScriptTag({
            content: `
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            if (node.classList && node.classList.contains('media-main-img')) {
                                Object.defineProperty(node, 'naturalWidth', { get: () => 600 });
                                Object.defineProperty(node, 'naturalHeight', { get: () => 1200 });
                                // Dispatch load event to trigger the application logic
                                node.dispatchEvent(new Event('load'));
                            }
                        });
                    });
                });
                observer.observe(document.body, { childList: true, subtree: true });
            `
        });

        // Upload portrait image
        await page.click('#btnSettings');
        const filePath = path.resolve(__dirname, '../fixtures/images/test_portrait.png');
        await page.setInputFiles('#inputLocalFiles', filePath);
        await page.click('#btnSave');

        // Wait for layout adjustment
        await page.waitForSelector('.media-main-img', { timeout: 10000 });

        await page.waitForTimeout(500);

        // Check if layout class 'pos-left' is applied
        const mainLayout = page.locator('#mainLayout');
        await expect(mainLayout).toHaveClass(/pos-left/);

        // Verify calendar direction (column)
        const calendarWrapper = page.locator('#calendarWrapper');
        await expect(calendarWrapper).toHaveCSS('flex-direction', 'column');

        await page.screenshot({ path: 'tests/e2e/screenshots/portrait_auto_layout.png', fullPage: true });
    });

    test('should respect manual settings when auto-layout is OFF', async ({ page }) => {
        // Disable auto layout
        await page.click('#btnSettings');
        await page.locator('#checkAutoLayout').uncheck();
        await page.click('#btnSave');

        // Set layout to top manually
        const mainLayout = page.locator('#mainLayout');
        // Initial state or cycle to top if needed
        // For simplicity, we just check it doesn't CHANGE to left on upload

        // Upload portrait image (which would normally trigger 'pos-left')
        const filePath = path.resolve(__dirname, '../fixtures/images/test_portrait.png');
        await page.setInputFiles('#inputLocalFiles', filePath);

        // Wait a bit to ensure NO auto-change happens
        await page.waitForTimeout(1000);

        // It should NOT be 'pos-left' if it wasn't already
        await expect(mainLayout).not.toHaveClass(/pos-left/);
    });
});
