const fs = require('fs');
const { JSDOM } = require('jsdom');
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="wrapper"></div><div id="date-hover-popup"></div></body></html>`, { url: 'http://localhost' });
global.document = dom.window.document;
global.window = dom.window;

const scriptContent = fs.readFileSync('src/script.js', 'utf8');
const codeToRun = scriptContent.replace("if (typeof document !== 'undefined') { document.addEventListener('DOMContentLoaded', init); }", "");

dom.window.eval(codeToRun);

const appSettings = dom.window.appSettings;
const eventTypes = [];
for(let i=0; i<50; i++) {
    eventTypes.push({ id: `ev_${i}`, label: `Event ${i}`, icon: 'star' });
}
appSettings.event_types = eventTypes;

const oshiList = [];
for(let i=0; i<2000; i++) {
    const memorial_dates = [];
    for(let j=0; j<20; j++) {
        memorial_dates.push({ type_id: `ev_${j%50}`, date: `2024/${(j%12)+1}/${(j%28)+1}`, is_annual: true });
    }
    oshiList.push({ name: `Oshi ${i}`, color: '#ff0000', memorial_dates });
}
appSettings.oshiList = oshiList;

const container = dom.window.document.getElementById('wrapper');
const renderCalendar = dom.window.renderCalendar;

console.time('renderCalendar_10x');
for(let i=0; i<10; i++) {
    renderCalendar(container, 2024, i%12 + 1);
}
console.timeEnd('renderCalendar_10x');
