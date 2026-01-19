/**
 * Oshigoto Calendar Logic & App
 */

// --- Settings State ---
const DEFAULT_SETTINGS = {
    startOfWeek: 0, // 0: Sun, 1: Mon
    monthCount: 2,  // 1, 2, 3
    layoutDirection: 'row', // 'row', 'column'
    // Oshi Settings (New List Structure)
    oshiList: [],
    // Legacy support (to be migrated)
    oshiName: '',
    oshiBirthday: '',
    oshiDebutDay: '',
    oshiColor: '#3b82f6',
    // Media Settings
    mediaMode: 'none', // 'none', 'single', 'random', 'cycle'
    mediaPosition: 'right', // 'top', 'bottom', 'left', 'right'
    mediaUrls: ''
};

let appSettings = { ...DEFAULT_SETTINGS };
const STORAGE_KEY = 'oshigoto_calendar_settings';

// Helper: Hex to RGB
function hexToRgb(hex) {
    // If hex is a named color, return null to fallback or handle otherwise (using CSS var usually)
    // Simple check for hex format
    if (!hex || !hex.startsWith('#')) return null;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
}

// Helper: Get Contrast Color (Black or White)
function getContrastColor(hex) {
    if (!hex || !hex.startsWith('#')) return '#000000';
    hex = hex.replace('#', '');

    let r, g, b;
    if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    } else {
        return '#000000';
    }

    // YIQ equation
    var yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 140) ? '#1a1a1a' : '#ffffff'; // 140 threshold, using dark gray for black for softer look
}

// Helper: Parse Date String to {month, day}
function parseDateString(str) {
    if (!str) return null;
    // Format: "YYYY/MM/DD" or "YYYY-MM-DD"
    let match = str.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (match) {
        return { month: parseInt(match[2]), day: parseInt(match[3]) };
    }
    // Format: "M月D日"
    match = str.match(/(\d{1,2})月(\d{1,2})日/);
    if (match) {
        return { month: parseInt(match[1]), day: parseInt(match[2]) };
    }
    // Format: "YYYY-MM-DD" standard date input value
    match = str.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        return { month: parseInt(match[2]), day: parseInt(match[3]) };
    }
    return null;
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
    // Structure creation if empty
    if (!container.querySelector('.days-grid')) {
        container.innerHTML = `
            <div class="month-header"><h2 class="month-title"></h2></div>
            <div class="weekday-header">${getWeekdayHeaderHTML(appSettings.startOfWeek)}</div>
            <div class="days-grid"></div>
        `;
    }

    // Update Headers
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

        // Check Multi-Oshi Events
        let oshiMarkups = [];

        // Loop through all oshis
        (appSettings.oshiList || []).forEach(oshi => {
            if (!oshi.name) return;

            const textColor = oshi.color ? getContrastColor(oshi.color) : '#333';
            const textShadow = textColor === '#ffffff' ? '0 0 1px rgba(0,0,0,0.3)' : 'none';
            const baseStyle = oshi.color ? `background-color: ${oshi.color}; color: ${textColor}; text-shadow: ${textShadow};` : '';

            // Birthday Check
            const bd = parseDateString(oshi.birthday);
            if (bd && bd.month === month && bd.day === d) {
                oshiMarkups.push(`<div class="oshi-event" style="${baseStyle}" title="誕生日: ${oshi.name}"><span class="oshi-event-icon">🎂</span>${oshi.name}</div>`);
            }

            // Anniversary Check
            const dd = parseDateString(oshi.debutDate);
            if (dd && dd.month === month && dd.day === d) {
                // Using 🎉 as it is universally celebratory.
                oshiMarkups.push(`<div class="oshi-event" style="${baseStyle}" title="記念日: ${oshi.name}"><span class="oshi-event-icon">🎉</span>${oshi.name}</div>`);
            }
        });

        if (oshiMarkups.length > 0) {
            el.classList.add('is-oshi-date');
        }

        let html = `<span class="day-number">${d}</span>`;
        if (holidayName) {
            html += `<span class="holiday-name">${holidayName}</span>`;
        }

        // Append Oshi Events
        if (oshiMarkups.length > 0) {
            html += `<div class="oshi-events-container">${oshiMarkups.join('')}</div>`;
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

    // Apply Media Position Class to Main Layout
    const mainLayout = document.getElementById('mainLayout');
    if (mainLayout) {
        mainLayout.className = `main-layout pos-${appSettings.mediaPosition}`;
    }

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

    // Apply position class to main-layout
    const mainLayout = document.getElementById('mainLayout');
    if (mainLayout) {
        // Remove existing pos- classes
        mainLayout.classList.remove('pos-top', 'pos-bottom', 'pos-left', 'pos-right');
        // Add new one
        mainLayout.classList.add(`pos-${appSettings.mediaPosition || 'right'}`);
    }

    const urls = appSettings.mediaUrls.split(',').map(u => u.trim()).filter(u => u);

    // Prepare Container Structure (Content Layer + UI Layer)
    let contentLayer = container.querySelector('.media-content-layer');
    if (!contentLayer) {
        container.innerHTML = ''; // Full reset if structure not present
        contentLayer = document.createElement('div');
        contentLayer.className = 'media-content-layer';
        contentLayer.style.width = '100%';
        contentLayer.style.height = '100%';
        contentLayer.style.display = 'flex';
        contentLayer.style.alignItems = 'center';
        contentLayer.style.justifyContent = 'center';
        container.appendChild(contentLayer);

        // Append Search UI
        appendSearchUI(container);
    }

    // Safety check: if UI is missing (e.g. accidentally cleared), re-append
    if (!container.querySelector('.media-search-btn')) {
        appendSearchUI(container);
    }

    if (urls.length === 0) {
        contentLayer.innerHTML = '<p class="media-placeholder">画像URLが設定されていません</p>';
        return;
    }

    let targetUrl = '';
    if (appSettings.mediaMode === 'single') {
        targetUrl = urls[0];
    } else if (appSettings.mediaMode === 'random') {
        targetUrl = urls[Math.floor(Math.random() * urls.length)];
    } else if (appSettings.mediaMode === 'cycle') {
        // Cycle based on current minute (to see changes faster than hour)
        const timeUnit = new Date().getMinutes();
        targetUrl = urls[timeUnit % urls.length];
    }

    if (!targetUrl) return;

    // Check if it is a Twitter/X URL
    const twitterMatch = targetUrl.match(/^https?:\/\/(twitter|x)\.com\/\w+\/status\/(\d+)/);

    if (twitterMatch) {
        const tweetId = twitterMatch[2];

        // Improve placeholder while loading
        const placeholder = document.createElement('div');
        placeholder.className = 'media-placeholder';
        placeholder.textContent = 'ツイートを読み込み中...';

        // Clear content layer
        contentLayer.innerHTML = '';
        contentLayer.appendChild(placeholder);

        // Ensure Widget JS is loaded
        if (window.twttr && window.twttr.widgets) {
            embedTweet(tweetId, contentLayer);
        } else {
            if (!document.getElementById('twitter-wjs')) {
                const script = document.createElement('script');
                script.id = 'twitter-wjs';
                script.src = "https://platform.twitter.com/widgets.js";
                script.async = true;
                document.body.appendChild(script);
            }

            // Poll for readiness (robust against parallel loads)
            const timer = setInterval(() => {
                if (window.twttr && window.twttr.widgets) {
                    clearInterval(timer);
                    embedTweet(tweetId, contentLayer);
                }
            }, 100);
        }
    } else {
        // Standard Image
        contentLayer.innerHTML = `<img src="${targetUrl}" alt="Oshi Media" onerror="this.parentElement.innerHTML='<p class=\'media-placeholder\'>画像の読み込みに失敗しました</p>'">`;
    }
}

// --- Quick Search UI ---
function appendSearchUI(container) {
    // Button
    const btn = document.createElement('div');
    btn.className = 'media-search-btn';
    btn.innerHTML = '🔍';
    btn.title = '推しを探す (Quick Search)';

    // Palette
    const palette = document.createElement('div');
    palette.className = 'search-palette hidden';

    // 1. Custom Search Header
    const header = document.createElement('div');
    header.className = 'palette-header';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'palette-search-input';
    input.placeholder = 'キーワードを検索...';

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
            const url = `https://x.com/search?q=${encodeURIComponent(input.value.trim())} filter:images&src=typed_query&f=media`;
            window.open(url, '_blank');
        }
    });
    header.appendChild(input);
    palette.appendChild(header);

    // 2. Oshi List
    const list = document.createElement('div');
    list.className = 'palette-list';

    if (appSettings.oshiList && appSettings.oshiList.length > 0) {
        appSettings.oshiList.forEach(oshi => {
            if (!oshi.fanArtTag) return;
            const item = document.createElement('div');
            item.className = 'palette-item';

            // Color dot
            const dot = document.createElement('span');
            dot.style.width = '10px';
            dot.style.height = '10px';
            dot.style.borderRadius = '50%';
            dot.style.backgroundColor = oshi.color || '#ccc';

            const name = document.createElement('span');
            name.textContent = `${oshi.name} (${oshi.fanArtTag})`;
            name.style.fontSize = '0.9rem';

            item.appendChild(dot);
            item.appendChild(name);

            item.addEventListener('click', () => {
                const url = `https://x.com/search?q=${encodeURIComponent(oshi.fanArtTag)} filter:images&src=typed_query&f=media`;
                window.open(url, '_blank');
            });

            list.appendChild(item);
        });
    } else {
        list.innerHTML = '<div style="padding:8px; font-size:0.8rem; color:#666;">推しが登録されていません</div>';
    }

    palette.appendChild(list);

    // Toggle Logic
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        palette.classList.toggle('hidden');
        if (!palette.classList.contains('hidden')) {
            input.focus();
        }
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!palette.contains(e.target) && !btn.contains(e.target)) {
            palette.classList.add('hidden');
        }
    });

    container.appendChild(btn);
    container.appendChild(palette);
}

function embedTweet(tweetId, container) {
    if (window.twttr && window.twttr.widgets) {
        // Clear content layer specifically
        container.innerHTML = '';

        window.twttr.widgets.createTweet(
            tweetId,
            container,
            {
                theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
                lang: 'ja',
                dnt: true
            }
        ).then(el => {
            if (!el) {
                container.innerHTML = '<p class="media-placeholder">ツイートの表示に失敗しました</p>';
            }
        });
    }
}

// --- Settings Logic ---

function renderOshiList() {
    const container = document.getElementById('oshiListContainer');
    if (!container) return;

    container.innerHTML = '';
    if (!appSettings.oshiList || appSettings.oshiList.length === 0) {
        container.innerHTML = '<p class="empty-list-message">まだ登録されていません</p>';
        return;
    }

    appSettings.oshiList.forEach((oshi, index) => {
        const item = document.createElement('div');
        item.className = 'oshi-item';

        // Ensure color is safe CSS
        const colorStyle = oshi.color ? `border-left: 4px solid ${oshi.color};` : '';

        item.innerHTML = `
            <div class="oshi-info" style="${colorStyle} padding-left: 8px;">
                <span class="oshi-name">${oshi.name}</span>
                <span class="oshi-source">src: ${oshi.source || 'manual'}</span>
            </div>
            <div class="oshi-actions" style="display:flex; gap:8px;">
                <button class="btn-delete" data-index="${index}">削除</button>
            </div>
        `;
        container.appendChild(item);
    });

    // Add Delete Listeners
    container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            appSettings.oshiList.splice(idx, 1);
            renderOshiList();
        });
    });
}

function handleFileImport() {
    const fileInput = document.getElementById('importJson');
    const files = fileInput.files;
    if (!files || files.length === 0) return;

    let processedCount = 0;

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    // Map to internal format
                    const newItems = data.map(item => ({
                        name: item['メンバー名'] || item.name || 'Unknown',
                        birthday: item['誕生日'] || item.birthday,
                        debutDate: item['周年記念日'] || item.debutDate,
                        color: item['公式カラー (Hex/系統)'] || item.color,
                        fanArtTag: item['ファンアートタグ'] || item.fanArtTag,
                        source: file.name
                    }));

                    appSettings.oshiList = [...(appSettings.oshiList || []), ...newItems];
                }
            } catch (err) {
                console.error('Failed to parse JSON', err);
                alert(`${file.name} の読み込みに失敗しました: ${err.message}`);
            } finally {
                processedCount++;
                if (processedCount === files.length) {
                    renderOshiList();
                    fileInput.value = ''; // Reset
                    alert(`${files.length} ファイルのインポートが完了しました`);
                }
            }
        };
        reader.readAsText(file);
    });
}

function addManualOshi() {
    const name = document.getElementById('newOshiName').value;
    const birthday = document.getElementById('newOshiBirthday').value;
    const debut = document.getElementById('newOshiDebutDay').value;
    const color = document.getElementById('newOshiColor').value;

    if (!name) {
        alert('名前を入力してください');
        return;
    }

    if (!appSettings.oshiList) appSettings.oshiList = [];
    appSettings.oshiList.push({
        name: name,
        birthday: birthday,
        debutDate: debut,
        color: color,
        source: 'manual'
    });

    renderOshiList();

    // Reset inputs
    document.getElementById('newOshiName').value = '';
    document.getElementById('newOshiBirthday').value = '';
    document.getElementById('newOshiDebutDay').value = '';
}

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

        // Media
        document.getElementById('mediaMode').value = appSettings.mediaMode;
        const radiosMediaPos = document.querySelectorAll('input[name="mediaPosition"]');
        radiosMediaPos.forEach(r => { if (r.value === appSettings.mediaPosition) r.checked = true; });
        document.getElementById('mediaUrls').value = appSettings.mediaUrls;

        // Render Oshi List
        renderOshiList();

        document.getElementById('settingsModal').showModal();
    });

    // Close Modal
    document.getElementById('btnCancel').addEventListener('click', () => {
        document.getElementById('settingsModal').close();
    });

    // Save Settings
    document.getElementById('btnSave').addEventListener('click', saveSettings);

    // Import Button
    document.getElementById('btnImport').addEventListener('click', handleFileImport);

    // Add Manual Button
    document.getElementById('btnAddManual').addEventListener('click', addManualOshi);
}

function loadSettings() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            appSettings = { ...DEFAULT_SETTINGS, ...parsed };

            // Migration: Logic to move single oshi to list if list is empty but single exists
            if ((!appSettings.oshiList || appSettings.oshiList.length === 0) && appSettings.oshiName) {
                appSettings.oshiList = [{
                    name: appSettings.oshiName,
                    birthday: appSettings.oshiBirthday,
                    debutDate: appSettings.oshiDebutDay,
                    color: appSettings.oshiColor,
                    source: 'legacy'
                }];
                // Clear legacy
                appSettings.oshiName = '';
            }
        } catch (e) { }
    }
    // updateView(); // Removed to prevent double rendering on init
}

function saveSettings() {
    // Basic
    const startOfWeekEl = document.querySelector('input[name="startOfWeek"]:checked');
    if (startOfWeekEl) appSettings.startOfWeek = parseInt(startOfWeekEl.value);

    const monthCountEl = document.querySelector('input[name="displayMonths"]:checked');
    if (monthCountEl) appSettings.monthCount = parseInt(monthCountEl.value);

    const layoutEl = document.querySelector('input[name="layout"]:checked');
    if (layoutEl) appSettings.layoutDirection = layoutEl.value;

    // Media
    appSettings.mediaMode = document.getElementById('mediaMode').value;
    const mediaPosEl = document.querySelector('input[name="mediaPosition"]:checked');
    if (mediaPosEl) appSettings.mediaPosition = mediaPosEl.value;
    appSettings.mediaUrls = document.getElementById('mediaUrls').value;

    // Note: oshiList is already updated in memory via adding/deleting buttons.
    // We just save the current state.

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

