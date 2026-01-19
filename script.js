/**
 * Oshigoto Calendar Logic & App
 */

// --- Settings State ---
const DEFAULT_SETTINGS = {
    startOfWeek: 0, // 0: Sun, 1: Mon
    monthCount: 2,  // 1, 2, 3
    layoutDirection: 'row', // 'row', 'column'
    // Oshi Settings
    oshiName: '',
    oshiBirthday: '',
    oshiDebutDay: '',
    oshiColor: '#3b82f6',
    // Media Settings
    mediaMode: 'none', // 'none', 'single', 'random', 'cycle'
    mediaUrls: ''
};

let appSettings = { ...DEFAULT_SETTINGS };
const STORAGE_KEY = 'oshigoto_calendar_settings';

// Helper: Hex to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
}

// --- Holiday Logic ---
function getJPHoliday(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const day = date.getDay();

    const isNthMonday = (n) => {
        if (day !== 1) return false;
        const min = (n - 1) * 7 + 1;
        const max = n * 7;
        return d >= min && d <= max;
    };

    const getVernalEquinox = (year) => Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    const getAutumnalEquinox = (year) => Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));

    if (m === 1 && d === 1) return "元日";
    if (m === 2 && d === 11) return "建国記念の日";
    if (m === 2 && d === 23) return "天皇誕生日";
    if (m === 4 && d === 29) return "昭和の日";
    if (m === 5 && d === 3) return "憲法記念日";
    if (m === 5 && d === 4) return "みどりの日";
    if (m === 5 && d === 5) return "こどもの日";
    if (m === 8 && d === 11) return "山の日";
    if (m === 11 && d === 3) return "文化の日";
    if (m === 11 && d === 23) return "勤労感謝の日";

    if (m === 1 && isNthMonday(2)) return "成人の日";
    if (m === 7 && isNthMonday(3)) return "海の日";
    if (m === 9 && isNthMonday(3)) return "敬老の日";
    if (m === 10 && isNthMonday(2)) return "スポーツの日";

    if (m === 3 && d === getVernalEquinox(y)) return "春分の日";
    if (m === 9 && d === getAutumnalEquinox(y)) return "秋分の日";

    const yesterday = new Date(date);
    yesterday.setDate(d - 1);
    if (yesterday.getDay() === 0) {
        const yHol = getJPHoliday(yesterday);
        if (yHol && yHol !== "振替休日") return "振替休日";
    }

    return null;
}

// --- Calendar Generation ---

const TODAY = new Date();
let currentRefDate = new Date();

// Generate Weekday Header HTML based on startOfWeek
function getWeekdayHeaderHTML(startOfWeek) {
    const days = [
        { label: '日', cls: 'sunday' },
        { label: '月', cls: '' },
        { label: '火', cls: '' },
        { label: '水', cls: '' },
        { label: '木', cls: '' },
        { label: '金', cls: '' },
        { label: '土', cls: 'saturday' }
    ];

    // Rotate array if startOfWeek is 1 (Mon)
    let orderedDays = [...days];
    if (startOfWeek === 1) {
        const sun = orderedDays.shift(); // Remove Sun
        orderedDays.push(sun); // Add Sun to end
    }

    return orderedDays.map(d => `<span class="${d.cls}">${d.label}</span>`).join('');
}

function renderCalendar(container, year, month) {
    // Set Custom Property for Oshi Color
    container.style.setProperty('--oshi-color', appSettings.oshiColor);
    container.style.setProperty('--oshi-color-rgb', hexToRgb(appSettings.oshiColor));

    // Structure creation if empty
    if (!container.querySelector('.days-grid')) {
        container.innerHTML = `
            <div class="month-header"><h2 class="month-title"></h2></div>
            <div class="weekday-header">${getWeekdayHeaderHTML(appSettings.startOfWeek)}</div>
            <div class="days-grid"></div>
        `;
    }

    // Update Headers if settings changed (e.g. startOfWeek) but reused container
    const headerEl = container.querySelector('.weekday-header');
    if (headerEl) headerEl.innerHTML = getWeekdayHeaderHTML(appSettings.startOfWeek);

    const title = container.querySelector('.month-title');
    const daysGrid = container.querySelector('.days-grid');

    title.textContent = `${year}年 ${month}月`;
    daysGrid.innerHTML = '';

    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    // Calculate Padding
    let startDayIndex = firstDayOfMonth.getDay() - appSettings.startOfWeek;
    if (startDayIndex < 0) startDayIndex += 7;

    const totalCellsFilled = startDayIndex + daysInMonth;
    const TOTAL_SLOTS = 42;

    // Days Parsing for Oshi
    const oshiBD = appSettings.oshiBirthday ? new Date(appSettings.oshiBirthday) : null;
    const oshiDD = appSettings.oshiDebutDay ? new Date(appSettings.oshiDebutDay) : null;

    // Padding Cells
    for (let i = 0; i < startDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'day-cell is-other-month';
        daysGrid.appendChild(emptyCell);
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
        const currentDate = new Date(year, month - 1, d);
        const dayOfWeek = currentDate.getDay();
        const el = document.createElement('div');
        el.className = 'day-cell';

        if (dayOfWeek === 0) el.classList.add('is-sunday');
        if (dayOfWeek === 6) el.classList.add('is-saturday');

        const isToday = (
            currentDate.getFullYear() === TODAY.getFullYear() &&
            currentDate.getMonth() === TODAY.getMonth() &&
            currentDate.getDate() === TODAY.getDate()
        );
        if (isToday) el.classList.add('is-today');

        // Japanese Holiday
        const holidayName = getJPHoliday(currentDate);
        if (holidayName) el.classList.add('is-holiday');

        // Oshi Dates Highlight
        let isOshiDate = false;
        let oshiLabel = '';
        if (oshiBD && currentDate.getMonth() === oshiBD.getMonth() && currentDate.getDate() === oshiBD.getDate()) {
            isOshiDate = true;
            oshiLabel = appSettings.oshiName ? `${appSettings.oshiName} 誕生日` : '誕生日';
        }
        if (oshiDD && currentDate.getMonth() === oshiDD.getMonth() && currentDate.getDate() === oshiDD.getDate()) {
            isOshiDate = true;
            oshiLabel = appSettings.oshiName ? `${appSettings.oshiName} デビュー日` : 'デビュー日';
        }
        if (isOshiDate) el.classList.add('is-oshi-date');

        let html = `<span class="day-number">${d}</span>`;
        if (holidayName) {
            html += `<span class="holiday-name">${holidayName}</span>`;
        } else if (oshiLabel) {
            html += `<span class="holiday-name">${oshiLabel}</span>`;
        }
        el.innerHTML = html;

        daysGrid.appendChild(el);
    }

    // Trailing Padding
    for (let i = totalCellsFilled; i < TOTAL_SLOTS; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'day-cell is-other-month';
        daysGrid.appendChild(emptyCell);
    }
}

function updateView() {
    const wrapper = document.getElementById('calendarWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = ''; // Clear current views

    // Apply Layout Class
    wrapper.className = `calendar-wrapper direction-${appSettings.layoutDirection}`;

    // Loop for Month Count
    let targetDate = new Date(currentRefDate); // Clone

    for (let i = 0; i < appSettings.monthCount; i++) {
        const section = document.createElement('section');
        section.className = 'calendar-month';
        section.id = `month-${i}`;

        const y = targetDate.getFullYear();
        const m = targetDate.getMonth() + 1;

        wrapper.appendChild(section);
        renderCalendar(section, y, m);

        // Advance 1 month
        targetDate.setMonth(targetDate.getMonth() + 1);
    }

    updateMediaArea();
}

// --- Media Logic ---
function updateMediaArea() {
    const area = document.getElementById('mediaArea');
    const container = document.getElementById('mediaContainer');
    if (!area || !container) return;

    if (appSettings.mediaMode === 'none') {
        area.style.display = 'none';
        return;
    }

    area.style.display = 'block';
    const urls = appSettings.mediaUrls.split(',').map(u => u.trim()).filter(u => u);

    if (urls.length === 0) {
        container.innerHTML = '<p class="media-placeholder">画像URLが設定されていません</p>';
        return;
    }

    let targetUrl = '';
    if (appSettings.mediaMode === 'single') {
        targetUrl = urls[0];
    } else if (appSettings.mediaMode === 'random') {
        targetUrl = urls[Math.floor(Math.random() * urls.length)];
    } else if (appSettings.mediaMode === 'cycle') {
        // Cycle based on current hour
        const hour = new Date().getHours();
        targetUrl = urls[hour % urls.length];
    }

    if (targetUrl) {
        container.innerHTML = `<img src="${targetUrl}" alt="Oshi Media" onerror="this.parentElement.innerHTML='<p class=\'media-placeholder\'>画像の読み込みに失敗しました</p>'">`;
    }
}

// --- Settings Logic ---

function initSettings() {
    // Open Modal
    document.getElementById('btnSettings').addEventListener('click', () => {
        // Basic
        const radiosStart = document.querySelectorAll('input[name="startOfWeek"]');
        radiosStart.forEach(r => { if (parseInt(r.value) === appSettings.startOfWeek) r.checked = true; });

        const radiosMonth = document.querySelectorAll('input[name="displayMonths"]');
        radiosMonth.forEach(r => { if (parseInt(r.value) === appSettings.monthCount) r.checked = true; });

        const radiosLayout = document.querySelectorAll('input[name="layout"]');
        radiosLayout.forEach(r => { if (r.value === appSettings.layoutDirection) r.checked = true; });

        // Oshi
        document.getElementById('oshiName').value = appSettings.oshiName;
        document.getElementById('oshiBirthday').value = appSettings.oshiBirthday;
        document.getElementById('oshiDebutDay').value = appSettings.oshiDebutDay;
        document.getElementById('oshiColor').value = appSettings.oshiColor;

        // Media
        document.getElementById('mediaMode').value = appSettings.mediaMode;
        document.getElementById('mediaUrls').value = appSettings.mediaUrls;

        document.getElementById('settingsModal').showModal();
    });

    // Close Modal
    document.getElementById('btnCancel').addEventListener('click', () => {
        document.getElementById('settingsModal').close();
    });

    // Save Settings
    document.getElementById('btnSave').addEventListener('click', saveSettings);
}

function loadSettings() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            appSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        } catch (e) { }
    }
    updateView();
}

function saveSettings() {
    // Basic
    const startOfWeekEl = document.querySelector('input[name="startOfWeek"]:checked');
    if (startOfWeekEl) appSettings.startOfWeek = parseInt(startOfWeekEl.value);

    const monthCountEl = document.querySelector('input[name="displayMonths"]:checked');
    if (monthCountEl) appSettings.monthCount = parseInt(monthCountEl.value);

    const layoutEl = document.querySelector('input[name="layout"]:checked');
    if (layoutEl) appSettings.layoutDirection = layoutEl.value;

    // Oshi
    appSettings.oshiName = document.getElementById('oshiName').value;
    appSettings.oshiBirthday = document.getElementById('oshiBirthday').value;
    appSettings.oshiDebutDay = document.getElementById('oshiDebutDay').value;
    appSettings.oshiColor = document.getElementById('oshiColor').value;

    // Media
    appSettings.mediaMode = document.getElementById('mediaMode').value;
    appSettings.mediaUrls = document.getElementById('mediaUrls').value;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
    document.getElementById('settingsModal').close();
    updateView();
}

function init() {
    loadSettings();
    initSettings();

    const dateDisplay = document.getElementById('currentDateDisplay');
    if (dateDisplay) {
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        dateDisplay.textContent = TODAY.toLocaleDateString('ja-JP', options);

        dateDisplay.addEventListener('click', () => {
            currentRefDate = new Date();
            updateView();
        });
    }

    updateView();

    document.getElementById('btnPrev').addEventListener('click', () => {
        currentRefDate.setMonth(currentRefDate.getMonth() - 1);
        updateView();
    });

    document.getElementById('btnNext').addEventListener('click', () => {
        currentRefDate.setMonth(currentRefDate.getMonth() + 1);
        updateView();
    });

    // Cycle check
    setInterval(() => {
        if (appSettings.mediaMode === 'cycle') updateMediaArea();
    }, 60000); // Every minute check (could be hour but minute is safer for immediate changes)
}

document.addEventListener('DOMContentLoaded', init);

