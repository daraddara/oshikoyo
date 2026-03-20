const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto(`file://${path.join(__dirname, 'index.html')}`);
    page.on('console', msg => console.log(msg.text()));

    await page.evaluate(async () => {
        // clear db
        await localImageDB.clearAll();

        const numImages = 500;
        const images = [];
        for (let i = 0; i < numImages; i++) {
            images.push({
                name: `img${i}.png`,
                type: 'image/png',
                data: 'data:image/png;base64,' + btoa(`dummydata_${i}`),
                lastModified: Date.now()
            });
        }

        // Apply optimized importData
        localImageDB.importData = async function(jsonData) {
            await this.open();
            if (!jsonData || !jsonData.images || !Array.isArray(jsonData.images)) {
                throw new Error('Invalid backup file format');
            }

            const existingImages = await this.getAllImages();
            let addedCount = 0;
            let skippedCount = 0;

            const existingSignatures = new Map();
            for (const img of existingImages) {
                const size = img.file.size;
                const type = img.file.type;
                const key = `${size}-${type}`;
                if (!existingSignatures.has(key)) {
                    existingSignatures.set(key, []);
                }
                // Store candidate objects instead of raw files to cache hashes
                existingSignatures.get(key).push({ file: img.file, hash: null });
            }

            const filesToAdd = [];

            // Helper to get cached hash
            const getHash = async (obj, file) => {
                if (obj.hash) return obj.hash;
                const buf = await file.arrayBuffer();
                // Use a simple checksum or SHA-1 for blobs if available, otherwise fallback to basic string
                // Since this runs in different contexts, let's use a very basic JS hash over the arrayBuffer to be completely synchronous and fallback-safe

                // For simplicity, let's read the whole file to a string-like hash using a fast 32-bit FNV-1a or just sample the file if too large?
                // Wait, areBlobsEqual is actually fast if we don't do it N^2 times.
                // Wait! If we don't use a hash, and just use areBlobsEqual but cache the ArrayBuffer or a Uint8Array representation?
                // But keeping 500 ArrayBuffers in memory is heavy.

                return null;
            };

            // But wait! If we just cache the ArrayBuffer?
            // `img${i}.png` is 1MB. 500MB might crash some browsers.
        };
    });

    await browser.close();
})();
