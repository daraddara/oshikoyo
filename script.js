/**
 * Oshikoyo Logic & App
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
    mediaIntervalRandom: 60, // seconds
    mediaIntervalCycle: 60, // seconds
};

// --- IndexedDB Management ---
class LocalImageDB {
    constructor(dbName = 'OshigotoCalendarDB', storeName = 'images') {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
    }

    async open() {
        if (this.db) return this.db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { autoIncrement: true });
                }
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async addImage(file) {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.add(file);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllImages() {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.getAll();
            const keyRequest = store.getAllKeys();

            let images = [];
            let keys = [];

            request.onsuccess = () => {
                images = request.result;
                if (keys.length > 0) resolve(this.combineKeysAndValues(keys, images));
            };
            keyRequest.onsuccess = () => {
                keys = keyRequest.result;
                if (images.length > 0) resolve(this.combineKeysAndValues(keys, images));
            };
            request.onerror = () => reject(request.error);
            keyRequest.onerror = () => reject(keyRequest.error);
        });
    }

    async getAllKeys() {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.getAllKeys();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getImage(key) {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteImage(key) {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clearAll() {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    combineKeysAndValues(keys, values) {
        return values.map((val, i) => ({ id: keys[i], file: val }));
    }
}

const localImageDB = new LocalImageDB();


let appSettings = { ...DEFAULT_SETTINGS };
const STORAGE_KEY = 'oshigoto_calendar_settings';

// Helper: Hex to RGB
function hexToRgb(hex) {
    if (!hex || !hex.startsWith('#')) return null;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
}

// Helper: Seconds <-> DHMS
function secondsToDHMS(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    seconds %= 3600 * 24;
    const h = Math.floor(seconds / 3600);
    seconds %= 3600;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return { d, h, m, s };
}

function dhmsToSeconds(d, h, m, s) {
    return (d * 86400) + (h * 3600) + (m * 60) + s;
}

// --- State Persistence (Separate from Settings) ---
const STATE_KEY = 'oshigoto_calendar_state';
let appState = {
    lastMediaKey: null,
    // Cycle mode specific state
};

function loadState() {
    try {
        const saved = localStorage.getItem(STATE_KEY);
        if (saved) appState = JSON.parse(saved);
    } catch (e) { console.error('Failed to load state', e); }
}

function saveState() {
    try {
        localStorage.setItem(STATE_KEY, JSON.stringify(appState));
    } catch (e) { console.error('Failed to save state', e); }
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

// --- Popup Logic ---
function createPopup() {
    if (!document.getElementById('date-hover-popup')) {
        const p = document.createElement('div');
        p.id = 'date-hover-popup';
        document.body.appendChild(p);
    }
}

function showPopup(e, html) {
    const popup = document.getElementById('date-hover-popup');
    if (!popup) return;
    popup.innerHTML = html;
    popup.style.display = 'block';

    const rect = e.target.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();

    // Initial Position: Top-Center of cell
    let top = rect.top - popupRect.height - 10;
    let left = rect.left + (rect.width / 2) - (popupRect.width / 2);

    // Boundary Checks
    if (top < 10) {
        top = rect.bottom + 10; // Flip to bottom if clipping top
    }
    if (left < 10) {
        left = 10;
    } else if (left + popupRect.width > window.innerWidth - 10) {
        left = window.innerWidth - popupRect.width - 10;
    }

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
}

function hidePopup() {
    const popup = document.getElementById('date-hover-popup');
    if (popup) popup.style.display = 'none';
}

function renderCalendar(container, year, month) {
    // Ensure popup exists
    createPopup();

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
        const dayOfWeek = currentDate.getDay(); // 0=Sun, 6=Sat
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
        let oshiPopupEvents = [];

        // Loop through all oshis
        (appSettings.oshiList || []).forEach(oshi => {
            if (!oshi.name) return;

            const textColor = oshi.color ? getContrastColor(oshi.color) : '#333';
            const textShadow = textColor === '#ffffff' ? '0 0 1px rgba(0,0,0,0.3)' : 'none';
            const baseStyle = oshi.color ? `background-color: ${oshi.color}; color: ${textColor}; text-shadow: ${textShadow};` : '';
            const borderStyle = oshi.color ? `border-left: 3px solid ${oshi.color};` : 'border-left: 3px solid #ccc;';

            // Birthday Check
            const bd = parseDateString(oshi.birthday);
            if (bd && bd.month === month && bd.day === d) {
                oshiMarkups.push(`<div class="oshi-event" style="${baseStyle}" title="誕生日: ${oshi.name}"><span class="oshi-event-icon">🎂</span>${oshi.name}</div>`);
                oshiPopupEvents.push(`<div class="popup-event-row" style="${baseStyle}">🎂 ${oshi.name} 誕生日</div>`);
            }

            // Anniversary Check
            const dd = parseDateString(oshi.debutDate);
            if (dd && dd.month === month && dd.day === d) {
                // Using 🎉 as it is universally celebratory.
                oshiMarkups.push(`<div class="oshi-event" style="${baseStyle}" title="記念日: ${oshi.name}"><span class="oshi-event-icon">🎉</span>${oshi.name}</div>`);
                oshiPopupEvents.push(`<div class="popup-event-row" style="${baseStyle}">🎉 ${oshi.name} 記念日</div>`);
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

        // --- Popup Content Generation ---
        const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];
        const dayLabel = dayLabels[dayOfWeek];

        let popupHtml = `<div class="popup-header"><span class="popup-date">${month}月${d}日 (${dayLabel})</span>`;
        if (holidayName) {
            popupHtml += `<span class="popup-holiday">${holidayName}</span>`;
        }
        popupHtml += `</div>`;

        if (oshiPopupEvents.length > 0) {
            popupHtml += `<div class="popup-events-container">${oshiPopupEvents.join('')}</div>`;
        }

        // Attach Hover Logic
        el.addEventListener('mouseenter', (e) => showPopup(e, popupHtml));
        el.addEventListener('mouseleave', hidePopup);

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

    const totalFiles = files.length; // Cache length before clearing input
    let processedCount = 0;
    let addedCount = 0;
    let skippedCount = 0;

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    // Map to internal format
                    const rawItems = data.map(item => ({
                        name: item['メンバー名'] || item.name || 'Unknown',
                        birthday: item['誕生日'] || item.birthday,
                        debutDate: item['周年記念日'] || item.debutDate,
                        color: item['公式カラー (Hex/系統)'] || item.color,
                        fanArtTag: item['ファンアートタグ'] || item.fanArtTag,
                        source: file.name
                    }));

                    // Deduplication Logic
                    const existingNames = new Set((appSettings.oshiList || []).map(o => o.name));
                    const newItems = rawItems.filter(item => {
                        if (existingNames.has(item.name)) {
                            skippedCount++;
                            return false;
                        }
                        return true;
                    });

                    addedCount += newItems.length;
                    appSettings.oshiList = [...(appSettings.oshiList || []), ...newItems];
                }
            } catch (err) {
                console.error('Failed to parse JSON', err);
                alert(`${file.name} の読み込みに失敗しました: ${err.message}`);
            } finally {
                processedCount++;
                if (processedCount === totalFiles) {
                    renderOshiList();
                    fileInput.value = ''; // Reset

                    let msg = `${totalFiles} ファイルのインポートが完了しました。`;
                    if (addedCount > 0) msg += `\n(${addedCount}件追加)`;
                    if (skippedCount > 0) msg += `\n(${skippedCount}件は重複のためスキップされました)`;

                    alert(msg);
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

// --- Local Media UI Handlers ---

async function updateLocalMediaUI() {
    const countEl = document.getElementById('localImageCount');
    if (countEl) {
        const keys = await localImageDB.getAllKeys();
        countEl.textContent = keys.length;
    }
}

async function renderLocalImageManager() {
    const list = document.getElementById('localImageList');
    if (!list) return;

    // Simple clear & loading
    list.innerHTML = '<p style="grid-column: 1/-1;">読み込み中...</p>';

    // Get all keys (lighter than getting all blobs)
    // To show thumbnails, we actually need blobs. 
    // If there are many, we should implement pagination.
    // For now, let's limit to recent 50 or just show all if < 100.
    // Let's grab all data for now (assuming users won't upload 1000s immediately).

    const allImages = await localImageDB.getAllImages();
    list.innerHTML = '';

    if (allImages.length === 0) {
        list.innerHTML = '<p style="grid-column: 1/-1; color:#888;">画像がありません</p>';
        return;
    }

    allImages.forEach(item => {
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.style.aspectRatio = '1/1';
        div.style.border = '1px solid #ddd';
        div.style.borderRadius = '4px';
        div.style.overflow = 'hidden';

        const img = document.createElement('img');
        img.src = URL.createObjectURL(item.file);
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';

        // Clean up URL object when removed (simplified here, ideally intersection observer)

        const btnDel = document.createElement('button');
        btnDel.type = 'button'; // Prevent form submission
        btnDel.textContent = '×';
        btnDel.style.position = 'absolute';
        btnDel.style.top = '2px';
        btnDel.style.right = '2px';
        btnDel.style.background = 'rgba(0,0,0,0.5)';
        btnDel.style.color = '#fff';
        btnDel.style.border = 'none';
        btnDel.style.borderRadius = '50%';
        btnDel.style.width = '20px';
        btnDel.style.height = '20px';
        btnDel.style.fontSize = '14px';
        btnDel.style.cursor = 'pointer';
        btnDel.title = '削除';

        btnDel.onclick = async (e) => {
            // Check if overlay already exists
            if (div.querySelector('.delete-confirm-overlay')) return;

            // Add Visual State
            div.classList.add('local-image-item'); // Ensure class presence for styling
            div.classList.add('is-deleting');

            // Create Overlay
            const overlay = document.createElement('div');
            overlay.className = 'delete-confirm-overlay';

            overlay.innerHTML = `
                <div class="delete-confirm-text">削除?</div>
                <div class="delete-confirm-actions">
                    <button class="btn-confirm-delete" type="button">はい</button>
                    <button class="btn-cancel-delete" type="button">いいえ</button>
                </div>
            `;

            // stopPropagation to prevent other clicks if any
            overlay.addEventListener('click', (ev) => ev.stopPropagation());

            // Handle Yes
            const btnYes = overlay.querySelector('.btn-confirm-delete');
            btnYes.addEventListener('click', async (ev) => {
                ev.stopPropagation(); // Prevent bubbling
                await localImageDB.deleteImage(item.id);
                URL.revokeObjectURL(img.src);
                renderLocalImageManager();
                updateLocalMediaUI();
            });

            // Handle No
            const btnNo = overlay.querySelector('.btn-cancel-delete');
            btnNo.addEventListener('click', (ev) => {
                ev.stopPropagation();
                div.removeChild(overlay);
                div.classList.remove('is-deleting');
            });

            div.appendChild(overlay);
        };

        div.appendChild(img);
        div.appendChild(btnDel);
        list.appendChild(div);
    });
}

async function handleLocalImageImport(files) {
    if (!files || files.length === 0) return;

    let addedCount = 0;

    for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        await localImageDB.addImage(file);
        addedCount++;
    }

    alert(`${addedCount} 枚の画像を追加しました`);
    updateLocalMediaUI();
    renderLocalImageManager();
}

function handleExportSettings() {
    const dataStr = JSON.stringify(appSettings, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `oshikoyo_settings_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function handleImportSettings(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            // Basic validation
            if (data.oshiList) {
                if (confirm('現在の設定を上書きします。よろしいですか？')) {
                    appSettings = { ...DEFAULT_SETTINGS, ...data };
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
                    alert('設定を復元しました。画面を更新します。');
                    location.reload();
                }
            } else {
                alert('無効な設定ファイルです。');
            }
        } catch (err) {
            console.error(err);
            alert('ファイルの読み込みに失敗しました。');
        }
    };
    reader.readAsText(file);
}

// --- Drag & Drop / Paste Logic ---
function setupDragAndDrop() {
    const container = document.getElementById('mediaContainer');
    if (!container) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        container.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Visual indicators
    ['dragenter', 'dragover'].forEach(eventName => {
        container.addEventListener(eventName, () => container.classList.add('drag-active'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        container.addEventListener(eventName, () => container.classList.remove('drag-active'), false);
    });

    // Handle Drop
    container.addEventListener('drop', handleDrop, false);

    async function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        await handleFiles(files);
    }
}

function setupClipboardPaste() {
    window.addEventListener('paste', async (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        const files = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
                const blob = items[i].getAsFile();
                if (blob) files.push(blob);
            }
        }
        if (files.length > 0) {
            e.preventDefault(); // Prevent default paste behavior
            await handleFiles(files);
        }
    });
}
let hasNewLocalImages = false;

async function handleFiles(files) {
    if (!files || files.length === 0) return;

    let count = 0;
    let lastKey = null;

    // Iterate and add
    for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) {
            lastKey = await localImageDB.addImage(file);
            count++;
        }
    }

    if (count > 0) {
        hasNewLocalImages = true;

        // Refresh UI
        updateLocalMediaUI();
        // If settings modal is open, refresh that too
        if (document.getElementById('settingsModal').open) {
            renderLocalImageManager();
        }

        // Show immediate feedback
        alert(`${count} 枚の画像を追加しました！`);

        // Immediately display the added image
        if (lastKey) {
            appState.lastMediaKey = lastKey;
            saveState();
            updateMediaArea(true); // Force display as if "init" with this key
        }
    }
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

        // Interval Settings (DHMS)
        const randTime = secondsToDHMS(appSettings.mediaIntervalRandom || 60);
        document.getElementById('randD').value = randTime.d;
        document.getElementById('randH').value = randTime.h;
        document.getElementById('randM').value = randTime.m;
        document.getElementById('randS').value = randTime.s;

        const cycTime = secondsToDHMS(appSettings.mediaIntervalCycle || 60);
        document.getElementById('cycD').value = cycTime.d;
        document.getElementById('cycH').value = cycTime.h;
        document.getElementById('cycM').value = cycTime.m;
        document.getElementById('cycS').value = cycTime.s;

        // Initialize Local UI visibility
        updateLocalMediaUI();

        // Use querySelector to find the details element we bound the event to
        const details = document.querySelector('.local-image-manager');
        if (details && (details.open || hasNewLocalImages)) {
            // If open OR we have new images (dirty), force render
            renderLocalImageManager();
            hasNewLocalImages = false;

            // If dirty, also ensure it is open so user sees it? 
            // User query: "Once I collapse and open it is displayed".
            // If it was open, we refresh. 
            // If it was closed, we refresh (so when they open it is ready) or rely on toggle?
            // "Toggle" event fires when opening. So if closed -> open, toggle handles it.
            // The issue is ONLY when it IS open (or appears so).
            // So (details.open || hasNewLocalImages) covers it. 
            // If dirty, we render even if closed (pre-load) or if open (refresh).
        }

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

    // Import Button (Oshi)
    document.getElementById('btnImport').addEventListener('click', handleFileImport);

    // Add Manual Button
    document.getElementById('btnAddManual').addEventListener('click', addManualOshi);

    // --- New Media & Data Handlers ---

    // Local Import (Folder)
    const inputFolder = document.getElementById('inputLocalFolder');
    document.getElementById('btnLocalFolder').addEventListener('click', () => inputFolder.click());
    inputFolder.addEventListener('change', (e) => handleLocalImageImport(e.target.files));

    // Local Import (Files)
    const inputFiles = document.getElementById('inputLocalFiles');
    document.getElementById('btnLocalFiles').addEventListener('click', () => inputFiles.click());
    inputFiles.addEventListener('change', (e) => handleLocalImageImport(e.target.files));

    // Clear Local
    document.getElementById('btnClearLocal').addEventListener('click', async () => {
        if (confirm('登録済みの画像をすべて削除します。よろしいですか？')) {
            await localImageDB.clearAll();
            updateLocalMediaUI();
            renderLocalImageManager();
        }
    });

    // Toggle Details (Load images only when opened)
    document.querySelector('.local-image-manager').addEventListener('toggle', (e) => {
        if (e.target.open) renderLocalImageManager();
    });

    // Export Settings
    document.getElementById('btnExportSettings').addEventListener('click', handleExportSettings);

    // Import Settings
    const inputImport = document.getElementById('inputImportSettings');
    document.getElementById('btnImportSettings').addEventListener('click', () => inputImport.click());
    inputImport.addEventListener('change', (e) => {
        if (e.target.files[0]) handleImportSettings(e.target.files[0]);
    });
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

    // Save Intervals
    const rD = parseInt(document.getElementById('randD').value) || 0;
    const rH = parseInt(document.getElementById('randH').value) || 0;
    const rM = parseInt(document.getElementById('randM').value) || 0;
    const rS = parseInt(document.getElementById('randS').value) || 0;
    appSettings.mediaIntervalRandom = dhmsToSeconds(rD, rH, rM, rS);
    if (appSettings.mediaIntervalRandom < 5) appSettings.mediaIntervalRandom = 5; // Min 5s safety

    const cD = parseInt(document.getElementById('cycD').value) || 0;
    const cH = parseInt(document.getElementById('cycH').value) || 0;
    const cM = parseInt(document.getElementById('cycM').value) || 0;
    const cS = parseInt(document.getElementById('cycS').value) || 0;
    appSettings.mediaIntervalCycle = dhmsToSeconds(cD, cH, cM, cS);
    if (appSettings.mediaIntervalCycle < 5) appSettings.mediaIntervalCycle = 5;

    // Note: oshiList is already updated in memory via adding/deleting buttons.
    // We just save the current state.

    localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
    document.getElementById('settingsModal').close();
    setupMediaTimer(); // Reset timer with new settings
    updateView();
}

function init() {
    loadSettings();
    loadState(); // Restore last state
    initSettings();
    setupDragAndDrop();
    setupClipboardPaste();

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

    // Cycle check (Refactored to dynamic timer)
    setupMediaTimer(true);
}

let mediaTimer = null;
let currentCycleIndex = -1;

function setupMediaTimer(isInit = false) {
    if (mediaTimer) clearInterval(mediaTimer);

    if (isInit) {
        updateMediaArea(true);
    }

    if (appSettings.mediaMode === 'none' || appSettings.mediaMode === 'single') return;

    let interval = 60;
    if (appSettings.mediaMode === 'random') interval = appSettings.mediaIntervalRandom || 60;
    if (appSettings.mediaMode === 'cycle') interval = appSettings.mediaIntervalCycle || 60;

    // Minimum safety
    if (interval < 5) interval = 5;

    // Helper for correct execution
    const tick = () => {
        if (appSettings.mediaMode === 'cycle' || appSettings.mediaMode === 'random') {
            updateMediaArea(false);
        }
    };

    mediaTimer = setInterval(tick, interval * 1000);
}

document.addEventListener('DOMContentLoaded', init);


// --- Media Logic ---
let currentMediaObjectURL = null;

async function updateMediaArea(isInit = false) { // Added isInit flag
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

    adjustMediaLayout();

    // Clean up previous ObjectURL if exists
    if (currentMediaObjectURL) {
        URL.revokeObjectURL(currentMediaObjectURL);
        currentMediaObjectURL = null;
    }

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


    }



    // --- Logic: Local Only ---
    try {
        const keys = await localImageDB.getAllKeys();
        if (keys.length === 0) {
            contentLayer.innerHTML = '<p class="media-placeholder">画像が登録されていません<br>設定から追加してください</p>';
            return;
        }

        let targetKey = null;

        if (isInit && appState.lastMediaKey && keys.includes(appState.lastMediaKey)) {
            // Restore last state on boot
            targetKey = appState.lastMediaKey;

            // Sync index if in cycle mode
            if (appSettings.mediaMode === 'cycle') {
                currentCycleIndex = keys.indexOf(targetKey);
            }
        } else {
            // Normal Rotation or First Run
            if (appSettings.mediaMode === 'single') {
                targetKey = keys[0];
            } else if (appSettings.mediaMode === 'random') {
                targetKey = keys[Math.floor(Math.random() * keys.length)];
            } else if (appSettings.mediaMode === 'cycle') {
                // State-based rotation
                if (currentCycleIndex === -1) {
                    // Start from 0 if undefined
                    currentCycleIndex = 0;
                } else {
                    // Next frame
                    currentCycleIndex = (currentCycleIndex + 1) % keys.length;
                }
                targetKey = keys[currentCycleIndex];
            }
        }

        // Save State
        if (targetKey) {
            appState.lastMediaKey = targetKey;
            saveState();

            const record = await localImageDB.getImage(targetKey);
            if (record) {
                currentMediaObjectURL = URL.createObjectURL(record);
                contentLayer.innerHTML = `<img src="${currentMediaObjectURL}" alt="Local Media" style="width:100%; height:100%; object-fit:contain;">`;
            }
        }
    } catch (e) {
        console.error(e);
        contentLayer.innerHTML = '<p class="media-placeholder">画像の読み込みエラー</p>';
    }
}

function adjustMediaLayout() {
    const area = document.getElementById('mediaArea');
    const container = document.getElementById('mediaContainer');
    if (!area || !container) return;

    if (appSettings.mediaMode === 'none') {
        area.style.display = 'none';
        return;
    }

    // Reset manual styles first
    area.style.width = '';
    area.style.maxWidth = '';
    container.style.height = '';

    const pos = appSettings.mediaPosition || 'right';
    const header = document.querySelector('.header');

    // Gaps estimate: Header Margin (24) + Layout Gap (24) + Padding (40) + Safety (20)
    // Adjusted to ensure bottom margin
    const gaps = 110;

    if (pos === 'top' || pos === 'bottom') {
        // --- Top/Bottom: Dynamic Width & Height ---

        // Width: Match Calendar
        const monthWidth = 550;
        const gap = 24;
        const count = appSettings.monthCount || 2;
        const targetWidth = (count * monthWidth) + ((count - 1) * gap);

        area.style.width = `${targetWidth}px`;
        area.style.maxWidth = '95vw';

        // Height: Fit to Remaining Window
        const calendarSection = document.querySelector('.calendar-section');
        if (header && calendarSection) {
            const headerH = header.offsetHeight;
            const calendarH = calendarSection.offsetHeight;
            const availableH = window.innerHeight - headerH - calendarH - gaps;

            // Minimum 250px
            container.style.height = `${Math.max(250, availableH)}px`;
        }
    } else {
        // --- Left/Right: Fixed 550px Width & Match Calendar Height ---

        // Width: Fixed 550px
        area.style.width = '550px';
        area.style.maxWidth = '550px';

        // Height: Match Calendar Section Height
        // This ensures "Unified Vertical Spec" - just as Top/Bottom matches Calendar Width
        const calendarSection = document.querySelector('.calendar-section');
        if (calendarSection) {
            // Wait for render/layout if needed? usually called after render
            const calH = calendarSection.offsetHeight;

            // If calendar is smaller than window height (e.g. 1 month row), maybe use window height?
            // User query: "Vertical size doesn't follow calendar vertical width".
            // Interpretation: If calendar is tall, image should use that height.
            // If calendar is short, should image shorten? Or stay max window?
            // Safer to use "Max of (Window-Header, Calendar)" to avoid shrinking too much?
            // But strict implementation of "Follow Calendar" means match height.

            // Let's match Calendar Height exactly (plus maybe some safety).
            // But add a minimum to avoid super small images if calendar is empty/small.

            // Wait, if calendar is huge (Vertical 3 months), we want huge image.
            container.style.height = `${Math.max(400, calH)}px`;
        }
    }
}



window.addEventListener('resize', adjustMediaLayout);
