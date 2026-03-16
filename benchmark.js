const { performance } = require('perf_hooks');

async function areBlobsEqualOld(buf1, buf2) {
    const arr1 = new Uint8Array(buf1);
    const arr2 = new Uint8Array(buf2);

    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }

    return true;
}

async function areBlobsEqualNew(buf1, buf2) {
    const len = buf1.byteLength;
    const remainder = len % 8;
    const mainLength = len - remainder;

    const view1 = new Float64Array(buf1, 0, mainLength / 8);
    const view2 = new Float64Array(buf2, 0, mainLength / 8);

    for (let i = 0; i < view1.length; i++) {
        if (view1[i] !== view2[i]) {
            // Check for NaN because NaN !== NaN
            if (Number.isNaN(view1[i]) && Number.isNaN(view2[i])) {
                // If both are NaN, we need to compare their byte representations
                // Because there are multiple NaN representations, we fall back to Uint8Array for this 8-byte chunk
                const byteView1 = new Uint8Array(buf1, i * 8, 8);
                const byteView2 = new Uint8Array(buf2, i * 8, 8);
                for (let j = 0; j < 8; j++) {
                    if (byteView1[j] !== byteView2[j]) return false;
                }
            } else {
                return false;
            }
        }
    }

    if (remainder > 0) {
        const tail1 = new Uint8Array(buf1, mainLength, remainder);
        const tail2 = new Uint8Array(buf2, mainLength, remainder);
        for (let i = 0; i < remainder; i++) {
            if (tail1[i] !== tail2[i]) return false;
        }
    }

    return true;
}

async function areBlobsEqualBigInt(buf1, buf2) {
    const len = buf1.byteLength;
    const remainder = len % 8;
    const mainLength = len - remainder;

    const view1 = new BigInt64Array(buf1, 0, mainLength / 8);
    const view2 = new BigInt64Array(buf2, 0, mainLength / 8);

    for (let i = 0; i < view1.length; i++) {
        if (view1[i] !== view2[i]) return false;
    }

    if (remainder > 0) {
        const tail1 = new Uint8Array(buf1, mainLength, remainder);
        const tail2 = new Uint8Array(buf2, mainLength, remainder);
        for (let i = 0; i < remainder; i++) {
            if (tail1[i] !== tail2[i]) return false;
        }
    }

    return true;
}

async function runBenchmark() {
    const size = 10 * 1024 * 1024; // 10MB
    const buf1 = new ArrayBuffer(size);
    const buf2 = new ArrayBuffer(size);

    const arr1 = new Uint8Array(buf1);
    const arr2 = new Uint8Array(buf2);

    for (let i = 0; i < size; i++) {
        arr1[i] = i % 256;
        arr2[i] = i % 256;
    }

    console.log("Warmup...");
    await areBlobsEqualOld(buf1, buf2);
    await areBlobsEqualNew(buf1, buf2);
    await areBlobsEqualBigInt(buf1, buf2);

    const iterations = 100;

    let start = performance.now();
    for (let i = 0; i < iterations; i++) {
        await areBlobsEqualOld(buf1, buf2);
    }
    let end = performance.now();
    console.log(`Old: ${end - start} ms`);

    start = performance.now();
    for (let i = 0; i < iterations; i++) {
        await areBlobsEqualNew(buf1, buf2);
    }
    end = performance.now();
    console.log(`New (Float64Array): ${end - start} ms`);

    start = performance.now();
    for (let i = 0; i < iterations; i++) {
        await areBlobsEqualBigInt(buf1, buf2);
    }
    end = performance.now();
    console.log(`New (BigInt64Array): ${end - start} ms`);
}

runBenchmark();
