const { chromium } = require('playwright');
const crypto = require('crypto');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log(msg.text()));

    // generate 5MB base64
    const base64Data = crypto.randomBytes(5 * 1024 * 1024).toString('base64');

    await page.evaluate(async (base64) => {
        const dataUri = `data:image/png;base64,${base64}`;

        let startFetch = performance.now();
        for(let i=0; i<5; i++) {
            const res = await fetch(dataUri);
            const buf = await res.arrayBuffer();
            new Uint8Array(buf);
        }
        console.log("fetch avg:", (performance.now() - startFetch)/5);

        let startAtob = performance.now();
        for(let i=0; i<5; i++) {
            const bstr = atob(base64);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
        }
        console.log("atob avg:", (performance.now() - startAtob)/5);

    }, base64Data);

    await browser.close();
})();
