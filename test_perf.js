const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const dom = new JSDOM(`<!DOCTYPE html><body><div id="calendarWrapper"></div></body>`, { runScripts: "dangerously" });
const window = dom.window;
const document = window.document;

window.localStorage = { getItem: () => null, setItem: () => {} };
window.navigator = { storage: { estimate: async () => ({}) } };

const scriptEl = document.createElement("script");
scriptEl.textContent = fs.readFileSync('src/script.js', 'utf8');
document.body.appendChild(scriptEl);

const appSettings = window.appSettings;
const getJPHoliday = window.getJPHoliday;

// Baseline
console.time('getJPHoliday 10000 times');
for (let i = 0; i < 10000; i++) {
   getJPHoliday(new Date('2024-01-01'));
}
console.timeEnd('getJPHoliday 10000 times');
