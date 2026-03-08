import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto('http://localhost:8081');

        // Open Settings Modal
        await page.click('#btnSettings');
        await page.waitForSelector('#settingsModal[open]', { state: 'visible' });

        console.log('--- Settings Modal Opened ---');

        // Check for specific elements
        const hasRandD = await page.$('#randD') !== null;
        console.log(`randD field exists: ${hasRandD}`);

        const hasBtnResetLayout = await page.$('#btnResetLayout') !== null;
        console.log(`btnResetLayout exists: ${hasBtnResetLayout}`);

        const hasSettingsGuide = await page.$('.settings-guide') !== null;
        console.log(`settings-guide class exists: ${hasSettingsGuide}`);

        const hasDisplayMonthsRadio = await page.$('input[name="displayMonths"]') !== null;
        console.log(`displayMonths radios exist: ${hasDisplayMonthsRadio}`);

        const hasLayoutRadio = await page.$('input[name="layout"]') !== null;
        console.log(`layout radios exist: ${hasLayoutRadio}`);

        const hasMediaPositionRadio = await page.$('input[name="mediaPosition"]') !== null;
        console.log(`mediaPosition radios exist: ${hasMediaPositionRadio}`);

    } catch (error) {
        console.error('Error during test:', error);
    } finally {
        await browser.close();
    }
})();
