import { defineConfig, devices } from '@playwright/test';
import { TEST_CONFIG } from './tests/test-config.js';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: TEST_CONFIG.workers !== 1,
    forbidOnly: !!process.env.CI,
    retries: TEST_CONFIG.retries,
    workers: TEST_CONFIG.workers,
    timeout: TEST_CONFIG.timeouts.long,
    expect: {
        timeout: TEST_CONFIG.timeouts.short,
        toHaveScreenshot: {
            maxDiffPixelRatio: TEST_CONFIG.visual.maxDiffPixelRatio,
            threshold: TEST_CONFIG.visual.threshold,
        },
    },
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:8081',
        trace: 'on-first-retry',
        actionTimeout: TEST_CONFIG.timeouts.short,
        navigationTimeout: TEST_CONFIG.timeouts.nav,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
            testIgnore: ['**/mobile_portrait.test.js', '**/mobile_landscape.test.js'],
        },
        {
            name: 'Mobile Chrome',
            use: { ...devices['Galaxy S9+'] },
            testIgnore: ['**/mobile_portrait.test.js', '**/mobile_landscape.test.js'],
        },
        {
            name: 'Mobile Safari',
            use: { ...devices['iPhone 12'] },
            testIgnore: ['**/mobile_portrait.test.js', '**/mobile_landscape.test.js'],
        },
        {
            name: 'Tablet',
            use: { ...devices['iPad (gen 7)'] },
            testIgnore: ['**/mobile_portrait.test.js', '**/mobile_landscape.test.js'],
        },
        // --- モバイル専用プロジェクト（testMatchで専用ファイルに限定）---
        {
            name: 'Mobile Landscape (Galaxy S25)',
            testMatch: '**/mobile_landscape.test.js',
            use: {
                ...devices['Galaxy S9+'],
                viewport: { width: 702, height: 360 },
                // width(702) > height(360) → orientation:landscape クエリが適用される
                // height(360) < 500px     → max-height:500px クエリも適用される
                // width(702) < 768px      → max-width:768px クエリも同時適用（実機再現）
            },
        },
        {
            name: 'Mobile Portrait (Galaxy S25)',
            testMatch: '**/mobile_portrait.test.js',
            use: {
                ...devices['Galaxy S9+'],
                viewport: { width: 360, height: 780 },
            },
        },
    ],
    webServer: {
        command: 'npm run serve',
        url: 'http://localhost:8081',
        reuseExistingServer: true,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 120000,
    },
});
