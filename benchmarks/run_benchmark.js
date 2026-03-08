const { chromium } = require('playwright');
const path = require('path');

async function run() {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const filePath = 'file://' + path.resolve('benchmark_idb_batch.html');
    await page.goto(filePath);
    await page.waitForSelector('#done');
    const content = await page.content();
    console.log(content.match(/Sequential: [\d.]+ ms/)[0]);
    console.log(content.match(/Parallel: [\d.]+ ms/)[0]);
    console.log(content.match(/Batch: [\d.]+ ms/)[0]);
    await browser.close();
}
run();
