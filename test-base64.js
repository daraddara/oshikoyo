const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.evaluate(async () => {
        // wait, we found that atob + charCodeAt is ~5500 ms for 500 images of 1MB,
        // but `importData` benchmark tests images of ~14 bytes (dummydata_${i}) and takes 5302 ms for 500 images!
        // The problem is NOT atob!
    });

    await browser.close();
})();
