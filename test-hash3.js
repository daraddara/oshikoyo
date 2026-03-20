const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`file://${path.join(__dirname, 'index.html')}`);
    page.on('console', msg => console.log(msg.text()));

    await page.evaluate(async () => {
        // Mock DB
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
                existingSignatures.get(key).push({ file: img.file, buf: null });
            }

            const filesToAdd = [];

            // Fast async blob equality function caching buffers
            async function getBuffer(obj, blob) {
                if (obj.buf) return obj.buf;
                obj.buf = await blob.arrayBuffer();
                return obj.buf;
            }

            for (const item of jsonData.images) {
                const blob = base64ToBlob(item.data, item.type);
                const key = `${blob.size}-${blob.type}`;
                let isDuplicate = false;

                if (existingSignatures.has(key)) {
                    const candidates = existingSignatures.get(key);
                    const incomingObj = { file: blob, buf: null };

                    for (const candidate of candidates) {
                        const buf1 = await getBuffer(incomingObj, blob);
                        const buf2 = await getBuffer(candidate, candidate.file);

                        if (buf1.byteLength === buf2.byteLength) {
                            const view1 = new BigInt64Array(buf1, 0, Math.floor(buf1.byteLength / 8));
                            const view2 = new BigInt64Array(buf2, 0, Math.floor(buf2.byteLength / 8));
                            let match = true;
                            for (let i = 0; i < view1.length; i++) {
                                if (view1[i] !== view2[i]) { match = false; break; }
                            }
                            if (match) {
                                const remainder = buf1.byteLength % 8;
                                if (remainder > 0) {
                                    const mainLength = buf1.byteLength - remainder;
                                    const tail1 = new Uint8Array(buf1, mainLength, remainder);
                                    const tail2 = new Uint8Array(buf2, mainLength, remainder);
                                    for (let i = 0; i < remainder; i++) {
                                        if (tail1[i] !== tail2[i]) { match = false; break; }
                                    }
                                }
                            }
                            if (match) {
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
                // Store candidate objects instead of raw files to cache buffers
                existingSignatures.get(key).push({ file: file, buf: null });

                addedCount++;
            }

            if (filesToAdd.length > 0) {
                await this.addImages(filesToAdd);
            }
            return { added: addedCount, skipped: skippedCount };
        };

        const start = performance.now();
        await localImageDB.importData({ images });
        console.log(`importData optimized caching arrayBuffer took ${performance.now() - start} ms`);
    });

    await browser.close();
})();
