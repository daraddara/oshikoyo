const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`file://${path.join(__dirname, 'index.html')}`);
    page.on('console', msg => console.log(msg.text()));

    await page.evaluate(async () => {
        // Wait, if we keep all arrayBuffers in memory during import, 500 images of 1MB = 500MB!
        // Is it better to just calculate a JS string hash (like DJB2 on first 1MB) and cache THAT?
        // Let's test keeping string hash vs arrayBuffer.

        async function getHash(obj, blob) {
            if (obj.hash !== null) return obj.hash;
            const buf = await blob.arrayBuffer();
            const view = new Uint8Array(buf);
            let hash = 5381;
            // sample max 100k bytes to avoid slow hashing of huge files
            const len = view.length;
            const step = Math.max(1, Math.floor(len / 100000));
            for (let i = 0; i < len; i += step) {
                hash = ((hash << 5) + hash) + view[i]; /* hash * 33 + c */
            }
            obj.hash = hash;
            return hash;
        }

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

        localImageDB.importData = async function(jsonData) {
            await this.open();

            const existingImages = await this.getAllImages();
            let addedCount = 0;
            let skippedCount = 0;

            const existingSignatures = new Map();
            for (const img of existingImages) {
                const key = `${img.file.size}-${img.file.type}`;
                if (!existingSignatures.has(key)) existingSignatures.set(key, []);
                existingSignatures.get(key).push({ file: img.file, hash: null });
            }

            const filesToAdd = [];

            for (const item of jsonData.images) {
                const blob = base64ToBlob(item.data, item.type);
                const key = `${blob.size}-${blob.type}`;
                let isDuplicate = false;

                if (existingSignatures.has(key)) {
                    const candidates = existingSignatures.get(key);
                    const incomingObj = { file: blob, hash: null };
                    const incomingHash = await getHash(incomingObj, blob);

                    for (const candidate of candidates) {
                        const candidateHash = await getHash(candidate, candidate.file);

                        if (incomingHash === candidateHash) {
                            // double check full binary equality to avoid hash collision
                            if (await areBlobsEqual(blob, candidate.file)) {
                                isDuplicate = true;
                                break;
                            }
                        }
                    }
                }

                if (isDuplicate) {
                    skippedCount++;
                    continue;
                }

                const file = new File([blob], item.name || 'imported_image', {
                    type: item.type,
                    lastModified: item.lastModified || Date.now()
                });

                filesToAdd.push(file);

                if (!existingSignatures.has(key)) existingSignatures.set(key, []);
                existingSignatures.get(key).push({ file: file, hash: null });

                addedCount++;
            }

            if (filesToAdd.length > 0) {
                await this.addImages(filesToAdd);
            }
            return { added: addedCount, skipped: skippedCount };
        };

        const start = performance.now();
        await localImageDB.importData({ images });
        console.log(`importData optimized caching JS hash took ${performance.now() - start} ms`);
    });

    await browser.close();
})();
