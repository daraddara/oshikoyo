const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log(msg.text()));

    await page.evaluate(async () => {
        // Simple hash function for ArrayBuffer
        async function getHash(blob) {
            const buf = await blob.arrayBuffer();
            const view = new Uint8Array(buf);
            // DJB2
            let hash = 5381;
            // Sampling to avoid hashing huge files slowly
            const len = view.length;
            const step = Math.max(1, Math.floor(len / 100000)); // Sample at most 100k bytes
            for (let i = 0; i < len; i += step) {
                hash = ((hash << 5) + hash) + view[i]; /* hash * 33 + c */
            }
            return hash;
        }

        const dummy1 = new Blob([new Uint8Array(10)], { type: 'image/png' });
        let start = performance.now();
        for(let i=0; i<5000; i++) {
            await getHash(dummy1);
        }
        console.log("DJB2 5000 times:", performance.now() - start);

        const dummyLarge = new Blob([new Uint8Array(1024 * 1024)], { type: 'image/png' });
        start = performance.now();
        for(let i=0; i<500; i++) {
            await getHash(dummyLarge);
        }
        console.log("DJB2 500 times 1MB:", performance.now() - start);
    });

    await browser.close();
})();
