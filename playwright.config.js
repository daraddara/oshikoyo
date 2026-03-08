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
        },
        {
            name: 'Mobile Chrome',
            use: { ...devices['Galaxy S9+'] },
        },
        {
            name: 'Mobile Safari',
            use: { ...devices['iPhone 12'] },
        },
        {
            name: 'Tablet',
            use: { ...devices['iPad (gen 7)'] },
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
