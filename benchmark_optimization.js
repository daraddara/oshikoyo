const fs = require('fs');
const { JSDOM } = require('jsdom');
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="wrapper"></div><div id="date-hover-popup"></div></body></html>`, { url: 'http://localhost' });
global.document = dom.window.document;
global.window = dom.window;

let scriptContent = fs.readFileSync('src/script.js', 'utf8');

// The original implementation is what we have in scriptContent.

// Now let's create a patched version.
let patchedContent = scriptContent.replace(`    // Days
    for (let d = 1; d <= daysInMonth; d++) {`, `    const eventTypesMap = new Map((appSettings.event_types || []).map(t => [t.id, t]));
    const eventsByDay = Array.from({ length: daysInMonth + 1 }, () => []);

    oshiEventDates.forEach(oshi => {
        if (!oshi.name) return;
        const matchedEventsByDay = new Map();
        for (const md of oshi.parsedMemorialDates) {
            if (!md.parsed) continue;
            const { year: pYear, month: pMonth, day: pDay } = md.parsed;
            if (pMonth !== month || pDay < 1 || pDay > daysInMonth) continue;
            if (!md.is_annual && pYear && pYear !== year) continue;

            const typeInfo = eventTypesMap.get(md.type_id);
            const icon = typeInfo?.icon || 'star';
            const label = escapeHTML(typeInfo?.label || md.type_id);

            if (!matchedEventsByDay.has(pDay)) {
                matchedEventsByDay.set(pDay, []);
            }
            matchedEventsByDay.get(pDay).push({ label, icon });
        }

        matchedEventsByDay.forEach((matchedEvents, pDay) => {
            eventsByDay[pDay].push({ oshi, matchedEvents });
        });
    });

    // Days
    for (let d = 1; d <= daysInMonth; d++) {`);

patchedContent = patchedContent.replace(`        // Check Multi-Oshi Events
        // Check Multi-Oshi Events
        let oshiMarkups = [];
        let oshiPopupEvents = [];
        let dayIcons = new Set();

        // Loop through all oshis
        oshiEventDates.forEach(oshi => {
            if (!oshi.name) return;

            const { textColor, textShadow, baseStyle, isDarkIcon, escapedName } = oshi;

            let matchedEvents = []; // { label, icon }

            // Memorial dates check
            for (const md of oshi.parsedMemorialDates) {
                if (!md.parsed) continue;
                const { year: pYear, month: pMonth, day: pDay } = md.parsed;
                if (pMonth !== month || pDay !== d) continue;
                // is_annual=false かつ日付に年がある場合はその年のみ表示
                if (!md.is_annual && pYear && pYear !== year) continue;

                const typeInfo = (appSettings.event_types || []).find(t => t.id === md.type_id);
                const icon = typeInfo?.icon || 'star';
                const label = escapeHTML(typeInfo?.label || md.type_id);
                dayIcons.add(icon);
                matchedEvents.push({ label, icon });
            }

            if (matchedEvents.length > 0) {
                const titleText = \`\${matchedEvents.map(e => e.label).join('・')}: \${escapedName}\`;
                oshiMarkups.push(\`<div class="oshi-event" style="\${baseStyle}" title="\${titleText}" data-oshi-name="\${escapedName}">\${escapedName}</div>\`);

                const iconsHtml = matchedEvents.map(e => buildEventIcon(e.icon, isDarkIcon, 'popup'));
                oshiPopupEvents.push(\`<div class="popup-event-row" style="\${baseStyle}">\${iconsHtml.join(' ')} \${escapedName} \${matchedEvents.map(e => e.label).join('・')}</div>\`);
            }
        });`, `        let oshiMarkups = [];
        let oshiPopupEvents = [];
        let dayIcons = new Set();

        for (const { oshi, matchedEvents } of eventsByDay[d]) {
            const { baseStyle, isDarkIcon, escapedName } = oshi;

            matchedEvents.forEach(e => dayIcons.add(e.icon));

            const titleText = \`\${matchedEvents.map(e => e.label).join('・')}: \${escapedName}\`;
            oshiMarkups.push(\`<div class="oshi-event" style="\${baseStyle}" title="\${titleText}" data-oshi-name="\${escapedName}">\${escapedName}</div>\`);

            const iconsHtml = matchedEvents.map(e => buildEventIcon(e.icon, isDarkIcon, 'popup'));
            oshiPopupEvents.push(\`<div class="popup-event-row" style="\${baseStyle}">\${iconsHtml.join(' ')} \${escapedName} \${matchedEvents.map(e => e.label).join('・')}</div>\`);
        }`);

const initScript = `if (typeof document !== 'undefined') { document.addEventListener('DOMContentLoaded', init); }`;
const cleanOriginal = scriptContent.replace(initScript, "");
const cleanPatched = patchedContent.replace(initScript, "");

// Run original
dom.window.eval(cleanOriginal);

let appSettings = dom.window.appSettings;
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

let originalRenderCalendar = dom.window.renderCalendar;

console.time('original');
for(let i=0; i<10; i++) {
    originalRenderCalendar(container, 2024, i%12 + 1);
}
console.timeEnd('original');

// Run patched
dom.window.eval(cleanPatched);
let patchedRenderCalendar = dom.window.renderCalendar;

console.time('patched');
for(let i=0; i<10; i++) {
    patchedRenderCalendar(container, 2024, i%12 + 1);
}
console.timeEnd('patched');
