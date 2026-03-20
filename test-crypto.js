const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.evaluate(async () => {
        const dummy1 = new Blob([new Uint8Array(10)], { type: 'image/png' });

        let start = performance.now();
        for(let i=0; i<5000; i++) {
            const buf = await dummy1.arrayBuffer();
            const digest = await crypto.subtle.digest('SHA-1', buf);
        }
        console.log("SHA-1 5000 times:", performance.now() - start);

    });

    await browser.close();
})();
