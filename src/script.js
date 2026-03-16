/**
 * おしこよ (Oshikoyo) ロジック & アプリケーション
 */

// --- Settings State ---
const DEFAULT_SETTINGS = {
    startOfWeek: 0, // 0: Sun, 1: Mon
    monthCount: 2,  // 1, 2
    layoutDirection: 'row', // 'row', 'column'
    // Oshi Settings (New List Structure)
    oshiList: [],
    // Media Settings
    mediaMode: 'single', // 'single', 'random', 'cycle'
    mediaPosition: 'top', // 'top', 'bottom', 'left', 'right'
    mediaSize: null,      // size of media area (width or height depending on position)
    mediaIntervalPreset: '1m', // '10s', '30s', '1m', '10m', '1h', '0:00', '4:00', 'startup'
    lastActiveInterval: '1m',
    autoLayoutMode: true,  // Automatically optimize layout based on image aspect ratio
};

// --- IndexedDB Management ---
/**
 * IndexedDB management for local image storage.
 */
class LocalImageDB {
    /**
     * @param {string} dbName - The name of the IndexedDB.
     * @param {string} storeName - The name of the object store.
     */
    constructor(dbName = 'OshikoyoDB', storeName = 'images') {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
    }

    /**
     * Opens the IndexedDB connection.
     * @returns {Promise<IDBDatabase>}
     */
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

    /**
     * Adds an image file to the database.
     * @param {File} file - The image file to add.
     * @returns {Promise<number>} The key of the added image.
     */
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

    /**
     * Adds multiple image files to the database in a single transaction.
     * @param {File[]} files - The image files to add.
     * @returns {Promise<Array<number>>} The keys of the added images.
     */
    async addImages(files) {
        if (!files || files.length === 0) return [];
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const keys = [];

            tx.oncomplete = () => resolve(keys);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(new Error('Transaction aborted'));

            for (const file of files) {
                const request = store.add(file);
                request.onsuccess = (e) => {
                    keys.push(e.target.result);
                };
            }
        });
    }

    /**
     * Retrieves all images and their keys from the database.
     * @returns {Promise<Array<{id: number, file: File}>>}
     */
    async getAllImages() {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.getAll();
            const keyRequest = store.getAllKeys();

            let images = null;
            let keys = null;

            const checkDone = () => {
                if (images !== null && keys !== null) {
                    resolve(this.combineKeysAndValues(keys, images));
                }
            };

            request.onsuccess = () => {
                images = request.result;
                checkDone();
            };
            keyRequest.onsuccess = () => {
                keys = keyRequest.result;
                checkDone();
            };
            request.onerror = () => reject(request.error);
            keyRequest.onerror = () => reject(keyRequest.error);
        });
    }

    /**
     * Retrieves all keys from the image store.
     * @returns {Promise<Array<number>>}
     */
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

    /**
     * Retrieves a single image by its key.
     * @param {number} key - The key of the image.
     * @returns {Promise<File>}
     */
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

    /**
     * Deletes an image by its key.
     * @param {number} key - The key of the image to delete.
     * @returns {Promise<void>}
     */
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

    /**
     * Clears all images from the database.
     * @returns {Promise<void>}
     */
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

    /**
     * Exports all image data as JSON chunks.
     * @param {number} [chunkSizeLimit=52428800] - Limit for each chunk in characters.
     * @returns {Promise<Array<{filename: string, data: object}>>}
     */
    async exportData(chunkSizeLimit = 50 * 1024 * 1024) {
        await this.open();
        const allImages = await this.getAllImages();
        const chunks = [];
        let currentChunk = {
            version: 1,
            timestamp: new Date().toISOString(),
            images: []
        };
        let currentSize = 0;
        let chunkIndex = 1;

        for (const item of allImages) {
            const base64 = await blobToBase64(item.file);
            const imageData = {
                id: item.id, // Keep original ID if possible, though re-import will assign new ID usually
                name: item.file.name,
                type: item.file.type,
                lastModified: item.file.lastModified,
                data: base64
            };

            const itemSize = base64.length; // Approximate size in chars (bytes is less, but string len matters for JSON)

            if (currentSize + itemSize > chunkSizeLimit && currentChunk.images.length > 0) {
                // Finalize current chunk
                chunks.push({
                    filename: `oshikoyo_images_backup_${currentChunk.timestamp.slice(0, 10)}_part${chunkIndex}.json`,
                    data: currentChunk
                });
                chunkIndex++;
                currentChunk = {
                    version: 1,
                    timestamp: new Date().toISOString(),
                    images: []
                };
                currentSize = 0;
            }

            currentChunk.images.push(imageData);
            currentSize += itemSize;
        }

        // Add last chunk
        if (currentChunk.images.length > 0) {
            chunks.push({
                filename: `oshikoyo_images_backup_${currentChunk.timestamp.slice(0, 10)}${chunks.length > 0 ? '_part' + chunkIndex : ''}.json`,
                data: currentChunk
            });
        }

        return chunks;
    }

    /**
     * Imports image data from a JSON object.
     * @param {object} jsonData - The imported JSON data.
     * @returns {Promise<{added: number, skipped: number}>}
     */
    async importData(jsonData) {
        await this.open();
        // Validation
        if (!jsonData || !jsonData.images || !Array.isArray(jsonData.images)) {
            throw new Error('Invalid backup file format');
        }

        const existingImages = await this.getAllImages();
        let addedCount = 0;
        let skippedCount = 0;

        // Pre-fetch all existing blobs to compare (might be heavy if many images, but necessary for dedup)
        // Optimization: Create a signature map (size + type) to reduce comparisons
        const existingSignatures = new Map();
        for (const img of existingImages) {
            const size = img.file.size;
            const type = img.file.type;
            const key = `${size}-${type}`;
            if (!existingSignatures.has(key)) {
                existingSignatures.set(key, []);
            }
            existingSignatures.get(key).push(img.file);
        }

        const filesToAdd = [];

        for (const item of jsonData.images) {
            const blob = base64ToBlob(item.data, item.type);

            // Deduplication Check
            let isDuplicate = false;
            const key = `${blob.size}-${blob.type}`;
            if (existingSignatures.has(key)) {
                const candidates = existingSignatures.get(key);
                for (const candidate of candidates) {
                    if (await areBlobsEqual(candidate, blob)) {
                        isDuplicate = true;
                        break;
                    }
                }
            }

            if (isDuplicate) {
                skippedCount++;
                continue;
            }

            // Restore metadata if possible (File constructor)
            const file = new File([blob], item.name || 'imported_image', {
                type: item.type,
                lastModified: item.lastModified || Date.now()
            });

            filesToAdd.push(file);

            // Add to ephemeral signature list to prevent duplicates within the same import batch
            if (!existingSignatures.has(key)) existingSignatures.set(key, []);
            existingSignatures.get(key).push(file);

            addedCount++;
        }

        if (filesToAdd.length > 0) {
            await this.addImages(filesToAdd);
        }

        return { added: addedCount, skipped: skippedCount };
    }

    /**
     * Helper to combine keys and values into objects.
     * @param {Array<number>} keys - Array of keys.
     * @param {Array<File>} values - Array of image files.
     * @returns {Array<{id: number, file: File}>}
     */
    combineKeysAndValues(keys, values) {
        return values.map((val, i) => ({ id: keys[i], file: val }));
    }
}

const localImageDB = new LocalImageDB();


let appSettings = { ...DEFAULT_SETTINGS };
const STORAGE_KEY = 'oshikoyo_settings';

// Helper: Blob to Base64
/**
 * Converts a Blob to a Base64 string.
 * @param {Blob} blob - The blob to convert.
 * @returns {Promise<string>}
 */
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // result looks like "data:image/png;base64,....."
            // We just want the comma onwards, or keep it all? 
            // Usually keeping it all is easier for img.src, but for clean data we might strip.
            // But base64ToBlob needs to know what to do. Let's keep it simple: keep the whole string.
            resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Helper: Base64 to Blob
/**
 * Converts a Base64 string back to a Blob.
 * @param {string} base64 - The base64 string.
 * @param {string} mimeType - The fallback MIME type.
 * @returns {Blob}
 */
function base64ToBlob(base64, mimeType) {
    // Basic validation
    if (typeof base64 !== 'string' || base64.length === 0) {
        throw new Error('Invalid base64 data');
    }

    base64 = base64.trim(); // Ensure no surrounding whitespace

    // If it contains data URI prefix, strip it (or fetch it)
    if (base64.startsWith('data:')) {
        const commaIndex = base64.indexOf(',');
        if (commaIndex === -1) {
            throw new Error('Invalid Data URI: no comma found');
        }

        const metadata = base64.substring(0, commaIndex);
        const data = base64.substring(commaIndex + 1);

        const mimeMatch = metadata.match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : mimeType; // Fallback if regex fails, though unlikely for valid Data URI

        const bstr = atob(data);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    } else {
        // Raw base64
        try {
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            return new Blob([byteArray], { type: mimeType });
        } catch (e) {
            console.error("atob failure:", e);
            throw new Error('Failed to decode base64 string');
        }
    }
}

// Helper: Compare Blobs
/**
 * Compares two Blobs for equality by content.
 * @param {Blob} blob1 
 * @param {Blob} blob2 
 * @returns {Promise<boolean>}
 */
async function areBlobsEqual(blob1, blob2) {
    if (blob1.size !== blob2.size) return false;
    if (blob1.type !== blob2.type) return false;

    const buf1 = await blob1.arrayBuffer();
    const buf2 = await blob2.arrayBuffer();

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

// Helper: Escape HTML
/**
 * Escapes special characters in a string to prevent XSS.
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string.
 */
function escapeHTML(str) {
    if (!str) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, m => map[m]);
}

// --- State Persistence (Separate from Settings) ---
const STATE_KEY = 'oshikoyo_state';
let appState = {
    lastMediaKey: null,
    // Cycle mode specific state
    // mediaHistory: [] // Runtime only, or persistent? Let's make it persistent for better UX on refresh
    mediaHistory: [],
    mediaHistoryIndex: -1 // Point to current position in history
};

/**
 * Loads the application state from localStorage.
 */
function loadState() {
    try {
        const saved = localStorage.getItem(STATE_KEY);
        if (saved) {
            const loaded = JSON.parse(saved);
            appState = { ...appState, ...loaded };

            // Safety checks for new properties
            if (!appState.mediaHistory) appState.mediaHistory = [];
            if (typeof appState.mediaHistoryIndex === 'undefined') appState.mediaHistoryIndex = -1;
        }
    } catch (e) { console.error('Failed to load state', e); }
}

/**
 * Saves the application state to localStorage.
 */
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

/**
 * Converts hex color to rgba.
 * @param {string} hex 
 * @param {number} alpha 
 * @returns {string}
 */
function hexToRgba(hex, alpha) {
    if (!hex || !hex.startsWith('#')) return hex;
    hex = hex.replace('#', '');
    let r, g, b;
    if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Helper: Parse Date String to {month, day}
function parseDateString(str) {
    if (!str) return null;
    str = str.trim();

    // Format: "YYYY/MM/DD" or "YYYY-MM-DD"
    let match = str.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (match) {
        return { month: parseInt(match[2]), day: parseInt(match[3]) };
    }

    // Format: "M/D" (year-less, e.g., 1/15)
    match = str.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (match) {
        return { month: parseInt(match[1]), day: parseInt(match[2]) };
    }

    // Format: "M月D日"
    match = str.match(/^(\d{1,2})月(\d{1,2})日$/);
    if (match) {
        return { month: parseInt(match[1]), day: parseInt(match[2]) };
    }

    // Format: "YYYY-MM-DD" standard date input value
    match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
        return { month: parseInt(match[2]), day: parseInt(match[3]) };
    }

    return null;
}

// --- Holiday Logic ---
const HOLIDAY_EXCEPTIONS = {
    // 2019年天皇即位関連
    "2019-04-30": "国民の休日",
    "2019-05-01": "即位の日",
    "2019-05-02": "国民の休日",
    "2019-10-22": "即位礼正殿の儀",
    // 2020年オリンピック特例
    "2020-07-20": null, // 海の日（移動前）
    "2020-07-23": "海の日",
    "2020-07-24": "スポーツの日",
    "2020-08-10": "山の日",
    "2020-08-11": null, // 山の日（移動前）
    "2020-10-12": null, // スポーツの日（移動前）
    // 2021年オリンピック特例
    "2021-07-19": null, // 海の日（移動前）
    "2021-07-22": "海の日",
    "2021-07-23": "スポーツの日",
    "2021-08-08": "山の日",
    "2021-08-09": "振替休日",
    "2021-08-11": null, // 山の日（移動前）
    "2021-10-11": null, // スポーツの日（移動前）
    // 敬老の日と秋分の日で挟まれる国民の休日（シルバーウィーク）
    "2009-09-22": "国民の休日",
    "2015-09-22": "国民の休日",
    "2026-09-22": "国民の休日",
    "2032-09-21": "国民の休日",
    "2037-09-22": "国民の休日"
};

function getJPHoliday(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const day = date.getDay();

    // フォーマット: YYYY-MM-DD
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    // 例外リストに存在する場合はそれを優先（特例や移動、新設など）
    if (HOLIDAY_EXCEPTIONS[dateStr] !== undefined) {
        return HOLIDAY_EXCEPTIONS[dateStr];
    }

    const isNthMonday = (n) => {
        if (day !== 1) return false;
        const min = (n - 1) * 7 + 1;
        const max = n * 7;
        return d >= min && d <= max;
    };

    const getVernalEquinox = (year) => {
        if (year <= 1947) return 0; // 祝日法施行前
        if (year <= 1979) return Math.floor(20.8357 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
        if (year <= 2099) return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
        return Math.floor(21.8510 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    };

    const getAutumnalEquinox = (year) => {
        if (year <= 1947) return 0; // 祝日法施行前
        if (year <= 1979) return Math.floor(23.2588 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
        if (year <= 2099) return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
        return Math.floor(24.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    };

    if (m === 1 && d === 1) return "元日";
    if (m === 2 && d === 11) return "建国記念の日";
    if (m === 2 && d === 23 && y >= 2020) return "天皇誕生日";
    if (m === 4 && d === 29) return y >= 2007 ? "昭和の日" : "みどりの日";
    if (m === 5 && d === 3) return "憲法記念日";
    if (m === 5 && d === 4) return y >= 2007 ? "みどりの日" : "国民の休日";
    if (m === 5 && d === 5) return "こどもの日";
    if (m === 8 && d === 11 && y >= 2016) return "山の日";
    if (m === 11 && d === 3) return "文化の日";
    if (m === 11 && d === 23) return "勤労感謝の日";
    if (m === 12 && d === 23 && y >= 1989 && y <= 2018) return "天皇誕生日";

    if (m === 1 && isNthMonday(2)) return y >= 2000 ? "成人の日" : null;
    if (m === 1 && d === 15 && y <= 1999) return "成人の日";

    if (m === 7 && isNthMonday(3)) return y >= 2003 ? "海の日" : null;
    if (m === 7 && d === 20 && y >= 1996 && y <= 2002) return "海の日";

    if (m === 9 && isNthMonday(3)) return y >= 2003 ? "敬老の日" : null;
    if (m === 9 && d === 15 && y <= 2002) return "敬老の日";

    if (m === 10 && isNthMonday(2)) return y >= 2020 ? "スポーツの日" : (y >= 2000 ? "体育の日" : null);
    if (m === 10 && d === 10 && y <= 1999) return "体育の日";

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

    // Pre-calculate parsed dates for oshi events to avoid redundant parsing in the day loop
    const oshiEventDates = (appSettings.oshiList || []).map(oshi => ({
        ...oshi,
        parsedBirthday: parseDateString(oshi.birthday),
        parsedDebutDate: parseDateString(oshi.debutDate)
    }));

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
        // Check Multi-Oshi Events
        let oshiMarkups = [];
        let oshiPopupEvents = [];
        let dayIcons = new Set();

        // Loop through all oshis
        oshiEventDates.forEach(oshi => {
            if (!oshi.name) return;

            const textColor = oshi.color ? getContrastColor(oshi.color) : '#333';
            const textShadow = textColor === '#ffffff' ? '0 0 1px rgba(0,0,0,0.3)' : 'none';

            let baseStyle = '';

            if (oshi.color) {
                const escapedColor = escapeHTML(oshi.color);
                const rgbaBg = hexToRgba(escapedColor, 0.85);
                baseStyle = `background-color: ${rgbaBg}; color: ${textColor}; text-shadow: ${textShadow};`;
            }

            const isDarkIcon = textColor === '#1a1a1a';
            const cakeIcon = `<span class="oshi-event-icon ${isDarkIcon ? 'is-dark' : ''}"><svg class="oshi-event-svg icon-pink" viewBox="0 0 24 24"><path d="M12 7v5"/><path d="M9 12h6v4H9z"/><path d="M5 16h14v4H5z"/><path d="M12 3a1 1 0 0 1 0 2 1 1 0 0 1 0-2z"/></svg></span>`;
            const crackerIcon = `<span class="oshi-event-icon ${isDarkIcon ? 'is-dark' : ''}"><svg class="oshi-event-svg icon-gold" viewBox="0 0 24 24"><path d="M8 12L2 22l10-6"/><path d="M14 6l.01.01"/><path d="M10 2l.01.01"/><path d="M18 10l.01.01"/><path d="M22 6l.01.01"/><path d="M17 3l.01.01"/><path d="M11 7l.01.01"/><path d="M20 14l.01.01"/></svg></span>`;

            let eventTypes = [];
            const escapedName = escapeHTML(oshi.name);

            // Birthday Check
            const bd = oshi.parsedBirthday;
            if (bd && bd.month === month && bd.day === d) {
                dayIcons.add('birthday');
                eventTypes.push('誕生日');
            }

            // Anniversary Check
            const dd = oshi.parsedDebutDate;
            if (dd && dd.month === month && dd.day === d) {
                dayIcons.add('anniversary');
                eventTypes.push('記念日');
            }

            if (eventTypes.length > 0) {
                const titleText = `${eventTypes.join('・')}: ${escapedName}`;
                oshiMarkups.push(`<div class="oshi-event" style="${baseStyle}" title="${titleText}">${escapedName}</div>`);
                
                let iconsHtml = [];
                if (eventTypes.includes('誕生日')) iconsHtml.push(cakeIcon);
                if (eventTypes.includes('記念日')) iconsHtml.push(crackerIcon);
                
                oshiPopupEvents.push(`<div class="popup-event-row" style="${baseStyle}">${iconsHtml.join(' ')} ${escapedName} ${eventTypes.join('・')}</div>`);
            }
        });

        if (oshiMarkups.length > 0) {
            el.classList.add('is-oshi-date');
        }

        let html = `<div class="day-header"><span class="day-number">${d}</span>`;
        if (dayIcons.size > 0) {
            html += `<div class="day-icons">`;
            if (dayIcons.has('birthday')) {
                html += `<span class="day-icon-badge"><svg class="day-icon-svg icon-pink" viewBox="0 0 24 24"><path d="M12 7v5"/><path d="M9 12h6v4H9z"/><path d="M5 16h14v4H5z"/><path d="M12 3a1 1 0 0 1 0 2 1 1 0 0 1 0-2z"/></svg></span>`;
            }
            if (dayIcons.has('anniversary')) {
                html += `<span class="day-icon-badge"><svg class="day-icon-svg icon-gold" viewBox="0 0 24 24"><path d="M8 12L2 22l10-6"/><path d="M14 6l.01.01"/><path d="M10 2l.01.01"/><path d="M18 10l.01.01"/><path d="M22 6l.01.01"/><path d="M17 3l.01.01"/><path d="M11 7l.01.01"/><path d="M20 14l.01.01"/></svg></span>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
        if (holidayName) {
            html += `<span class="holiday-name">${escapeHTML(holidayName)}</span>`;
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
            popupHtml += `<span class="popup-holiday">${escapeHTML(holidayName)}</span>`;
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

    updateMediaArea('layout');
}

// --- Media Logic ---
// --- Settings Logic ---

function renderOshiList() {
    // Now only updates the count display in the main settings modal
    const countEl = document.getElementById('oshiCount');
    if (countEl) {
        countEl.textContent = (appSettings.oshiList || []).length;
    }
}

function openOshiManager() {
    renderOshiTable();
    document.getElementById('oshiManagementModal').showModal();
}

function renderOshiTable() {
    const tbody = document.getElementById('oshiTableBody');
    const emptyMsg = document.getElementById('oshiTableEmpty');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!appSettings.oshiList || appSettings.oshiList.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
        return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';

    appSettings.oshiList.forEach((oshi, index) => {
        const row = document.createElement('tr');

        // Color swatch
        const colorCell = document.createElement('td');
        const swatch = document.createElement('span');
        swatch.className = 'oshi-color-swatch';
        swatch.style.backgroundColor = oshi.color || '#ccc';
        colorCell.appendChild(swatch);
        row.appendChild(colorCell);

        // Name
        const nameCell = document.createElement('td');
        nameCell.textContent = oshi.name || '-';
        row.appendChild(nameCell);

        // Birthday
        const bdCell = document.createElement('td');
        bdCell.textContent = oshi.birthday || '-';
        row.appendChild(bdCell);

        // Debut Date
        const ddCell = document.createElement('td');
        ddCell.textContent = oshi.debutDate || '-';
        row.appendChild(ddCell);

        // Source
        const srcCell = document.createElement('td');
        srcCell.textContent = oshi.source || 'manual';
        srcCell.style.fontSize = '0.8rem';
        srcCell.style.color = '#888';
        row.appendChild(srcCell);

        // Actions
        const actCell = document.createElement('td');

        // Edit Button
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn-edit-row';
        editBtn.textContent = '編集';
        editBtn.addEventListener('click', () => openOshiEditForm(index));
        actCell.appendChild(editBtn);

        // Delete Button
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn-delete-row';
        delBtn.textContent = '削除';
        delBtn.addEventListener('click', () => {
            if (confirm(`「${oshi.name}」を削除しますか？`)) {
                appSettings.oshiList.splice(index, 1);
                renderOshiTable();
                renderOshiList(); // Update count in main settings
            }
        });
        actCell.appendChild(delBtn);
        row.appendChild(actCell);

        tbody.appendChild(row);
    });
}

// --- Oshi Edit Form ---
function openOshiEditForm(index = -1) {
    const titleEl = document.getElementById('oshiEditTitle');
    const indexEl = document.getElementById('oshiEditIndex');
    const nameEl = document.getElementById('oshiEditName');
    const colorEl = document.getElementById('oshiEditColor');
    const bdEl = document.getElementById('oshiEditBirthday');
    const ddEl = document.getElementById('oshiEditDebutDay');

    indexEl.value = index;

    if (index >= 0 && appSettings.oshiList && appSettings.oshiList[index]) {
        // Edit mode
        const oshi = appSettings.oshiList[index];
        titleEl.textContent = '編集';
        nameEl.value = oshi.name || '';
        colorEl.value = oshi.color || '#3b82f6';
        bdEl.value = oshi.birthday || '';
        ddEl.value = oshi.debutDate || '';
    } else {
        // Add mode
        titleEl.textContent = '新規追加';
        nameEl.value = '';
        colorEl.value = '#3b82f6';
        bdEl.value = '';
        ddEl.value = '';
    }

    document.getElementById('oshiEditModal').showModal();
}

function saveOshiFromForm() {
    const index = parseInt(document.getElementById('oshiEditIndex').value);
    const name = document.getElementById('oshiEditName').value.trim();
    const color = document.getElementById('oshiEditColor').value;
    const birthday = document.getElementById('oshiEditBirthday').value;
    const debutDate = document.getElementById('oshiEditDebutDay').value;

    if (!name) {
        alert('名前を入力してください');
        return;
    }

    if (!appSettings.oshiList) appSettings.oshiList = [];

    const oshiData = {
        name,
        color,
        birthday,
        debutDate,
        source: index >= 0 ? (appSettings.oshiList[index]?.source || 'manual') : 'manual'
    };

    if (index >= 0) {
        // Update existing
        appSettings.oshiList[index] = oshiData;
    } else {
        // Add new
        appSettings.oshiList.push(oshiData);
    }

    document.getElementById('oshiEditModal').close();
    renderOshiTable();
    renderOshiList();
}

// --- Oshi Export ---
function handleOshiExport() {
    if (!appSettings.oshiList || appSettings.oshiList.length === 0) {
        showToast('エクスポートするデータがありません。');
        return;
    }

    const count = appSettings.oshiList.length;
    const dataStr = JSON.stringify(appSettings.oshiList, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `oshi_list_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`${count}件のデータをエクスポートしました`);
}

// --- Oshi Import (for modal) ---
function handleOshiImportFromModal(files) {
    if (!files || files.length === 0) return;

    let addedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const totalFiles = files.length;
    let processedCount = 0;
    let errorMessages = [];

    const existingNames = new Set((appSettings.oshiList || []).map(o => o.name));

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                // Validate data structure
                if (!Array.isArray(data)) {
                    errorCount++;
                    errorMessages.push(`${file.name}: 配列形式ではありません`);
                    processedCount++;
                    checkComplete();
                    return;
                }

                if (data.length === 0) {
                    errorCount++;
                    errorMessages.push(`${file.name}: データが空です`);
                    processedCount++;
                    checkComplete();
                    return;
                }

                const rawItems = data.map(item => ({
                    name: item['メンバー名'] || item.name || '',
                    birthday: item['誕生日'] || item.birthday || '',
                    debutDate: item['周年記念日'] || item.debutDate || '',
                    color: item['公式カラー (Hex/系統)'] || item.color || '',
                    fanArtTag: item['ファンアートタグ'] || item.fanArtTag || '',
                    source: file.name
                })).filter(item => item.name); // Filter out items without names

                if (rawItems.length === 0) {
                    errorCount++;
                    errorMessages.push(`${file.name}: 有効なデータがありません（名前が必須）`);
                    processedCount++;
                    checkComplete();
                    return;
                }

                const newItems = rawItems.filter(item => {
                    if (existingNames.has(item.name)) {
                        skippedCount++;
                        return false;
                    }
                    existingNames.add(item.name);
                    return true;
                });

                if (!appSettings.oshiList) appSettings.oshiList = [];
                appSettings.oshiList.push(...newItems);
                addedCount += newItems.length;

            } catch (err) {
                console.error('Import error:', err);
                errorCount++;
                errorMessages.push(`${file.name}: JSONの解析に失敗しました`);
            }

            processedCount++;
            checkComplete();
        };

        reader.onerror = () => {
            errorCount++;
            errorMessages.push(`${file.name}: ファイルの読み込みに失敗しました`);
            processedCount++;
            checkComplete();
        };

        reader.readAsText(file);
    });

    function checkComplete() {
        if (processedCount === totalFiles) {
            renderOshiTable();
            renderOshiList();

            let message = `インポート完了: ${addedCount}件追加`;
            if (skippedCount > 0) {
                message += `, ${skippedCount}件スキップ（重複）`;
            }
            if (errorCount > 0) {
                message += `\nエラー: ${errorCount}件`;
                if (errorMessages.length > 0) {
                    message += '\n' + errorMessages.slice(0, 3).join('\n');
                    if (errorMessages.length > 3) {
                        message += `\n...他${errorMessages.length - 3}件`;
                    }
                }
                showToast(message, 5000); // Longer display for errors
            } else {
                showToast(message);
            }
        }
    }
}

function handleFileImport() {
    const fileInput = document.getElementById('importJson');
    const files = fileInput.files;
    if (!files || files.length === 0) return;

    const totalFiles = files.length; // Cache length before clearing input
    let processedCount = 0;
    let addedCount = 0;
    let skippedCount = 0;

    const existingNames = new Set((appSettings.oshiList || []).map(o => o.name));

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
                    const newItems = rawItems.filter(item => {
                        if (existingNames.has(item.name)) {
                            skippedCount++;
                            return false;
                        }
                        existingNames.add(item.name);
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

    // Check keys first to avoid unnecessary loading state
    const keys = await localImageDB.getAllKeys();
    if (keys.length === 0) {
        list.innerHTML = '<p style="grid-column: 1/-1; color:#888;">画像がありません</p>';
        return;
    }

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
        // Should be covered by keys check, but safety net
        list.innerHTML = '<p style="grid-column: 1/-1; color:#888;">画像がありません</p>';
        return;
    }

    const fragment = document.createDocumentFragment();

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
        fragment.appendChild(div);
    });

    list.appendChild(fragment);
}

async function handleLocalImageImport(files) {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    await localImageDB.addImages(fileArray);
    const addedCount = fileArray.length;

    showToast(`${addedCount} 枚の画像を追加しました`);
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

// Helper: Validate Imported Settings
function validateImportedSettings(data) {
    if (!data || typeof data !== 'object') return null;

    const validated = {};

    // Root properties
    if (typeof data.startOfWeek === 'number') validated.startOfWeek = data.startOfWeek;
    if (typeof data.monthCount === 'number') validated.monthCount = data.monthCount;
    if (typeof data.layoutDirection === 'string') validated.layoutDirection = data.layoutDirection;
    if (typeof data.mediaMode === 'string') validated.mediaMode = data.mediaMode;
    if (typeof data.mediaPosition === 'string') validated.mediaPosition = data.mediaPosition;
    if (typeof data.mediaSize === 'number' || data.mediaSize === null) validated.mediaSize = data.mediaSize;
    if (typeof data.mediaIntervalPreset === 'string') validated.mediaIntervalPreset = data.mediaIntervalPreset;
    if (typeof data.autoLayoutMode === 'boolean') validated.autoLayoutMode = data.autoLayoutMode;

    // Validate oshiList
    if (Array.isArray(data.oshiList)) {
        validated.oshiList = data.oshiList.map(item => {
            if (!item || typeof item !== 'object') return null;
            return {
                name: typeof item.name === 'string' ? item.name : 'Unknown',
                birthday: typeof item.birthday === 'string' ? item.birthday : '',
                debutDate: typeof item.debutDate === 'string' ? item.debutDate : '',
                color: typeof item.color === 'string' ? item.color : '#3b82f6',
                fanArtTag: typeof item.fanArtTag === 'string' ? item.fanArtTag : '',
                source: typeof item.source === 'string' ? item.source : ''
            };
        }).filter(item => item !== null);
    } else {
        return null; // Reject if oshiList is missing or not an array
    }

    return validated;
}
// --- Validation Logic End ---

function handleImportSettings(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const validatedData = validateImportedSettings(data);

            if (validatedData) {
                if (confirm('現在の設定を上書きします。よろしいですか？')) {
                    appSettings = { ...DEFAULT_SETTINGS, ...validatedData };
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

async function handleImportImages(files) {
    if (!files || files.length === 0) {
        return;
    }

    let totalAdded = 0;
    let totalSkipped = 0;
    let errorCount = 0;

    let lastError = null;

    const importPromises = Array.from(files).map(async (file) => {
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            const result = await localImageDB.importData(json);
            totalAdded += result.added;
            totalSkipped += result.skipped;
        } catch (e) {
            console.error("Import failed for file:", file.name, e);
            errorCount++;
            lastError = e;
        }
    });

    await Promise.all(importPromises);

    let msg = `インポート完了: \n追加: ${totalAdded} 件\n重複スキップ: ${totalSkipped} 件`;
    if (errorCount > 0) {
        msg += `\nエラー: ${errorCount} ファイル`;
        if (lastError) {
            msg += `\n詳細: ${lastError.message} `;
        }
    }

    alert(msg);
    if (totalAdded > 0) {
        updateLocalMediaUI();
        renderLocalImageManager();
    }
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
    // Detect Internal Drag
    container.addEventListener('dragstart', (e) => {
        if (e.target.tagName === 'IMG') {
            e.dataTransfer.setData('application/x-oshigoto-internal', 'true');
        }
    });

    container.addEventListener('drop', handleDrop, false);

    async function handleDrop(e) {
        // Ignore internal drops
        if (e.dataTransfer.getData('application/x-oshigoto-internal') === 'true') {
            return;
        }

        const dt = e.dataTransfer;
        const files = dt.files;
        await handleFiles(files);
    }

    // --- Layout Drag & Drop ---
    const dragHandle = document.getElementById('mediaDragHandle');
    const mainLayout = document.getElementById('mainLayout');
    const dropzones = document.querySelectorAll('.layout-dropzone');

    if (dragHandle && mainLayout) {
        // ドラッグ開始
        dragHandle.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/x-oshigoto-layout', 'true');
            // 少し遅らせてクラスを付与（即座だとドラッグイメージも半透明になる場合があるため）
            setTimeout(() => {
                mainLayout.classList.add('is-dragging-layout');
            }, 10);
        });

        // ドラッグ終了
        dragHandle.addEventListener('dragend', () => {
            mainLayout.classList.remove('is-dragging-layout');
            dropzones.forEach(zone => zone.classList.remove('drag-over'));
        });

        // ドロップゾーンのイベント
        dropzones.forEach(zone => {
            zone.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (e.dataTransfer.types.includes('application/x-oshigoto-layout')) {
                    zone.classList.add('drag-over');
                }
            });

            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            zone.addEventListener('dragleave', () => {
                zone.classList.remove('drag-over');
            });

            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('drag-over');

                if (e.dataTransfer.types.includes('application/x-oshigoto-layout')) {
                    const newPos = zone.getAttribute('data-position');
                    if (newPos && ['top', 'bottom', 'left', 'right'].includes(newPos)) {
                        appSettings.mediaPosition = newPos;

                        // 位置が変わったらサイズ制約をリセットする
                        appSettings.mediaSize = null;

                        // 設定モーダルの内容を上書きしないよう直接保存とUI更新のみ行う
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
                        updateView();
                    }
                }
            });
        });
    }

    // --- Splitter Resizing ---
    const splitter = document.getElementById('layoutSplitter');
    const mediaArea = document.getElementById('mediaArea');
    if (splitter && mediaArea && mainLayout) {
        let isResizing = false;
        let startPos = 0;
        let startSize = 0;
        let direction = ''; // 'horizontal' (x-axis) or 'vertical' (y-axis)

        splitter.addEventListener('mousedown', (e) => {
            isResizing = true;
            mainLayout.classList.add('is-resizing');
            splitter.classList.add('is-resizing');

            const pos = appSettings.mediaPosition || 'right';
            if (pos === 'left' || pos === 'right') {
                direction = 'horizontal';
                startPos = e.clientX;
                startSize = mediaArea.offsetWidth;
            } else {
                direction = 'vertical';
                startPos = e.clientY;
                startSize = mediaArea.offsetHeight;
            }
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            let newSize = startSize;
            const pos = appSettings.mediaPosition || 'right';

            if (direction === 'horizontal') {
                const deltaX = e.clientX - startPos;
                // 'left' layout: image is on left, drag right increases width
                // 'right' layout: image is on right, drag left increases width
                newSize = pos === 'left' ? startSize + deltaX : startSize - deltaX;
            } else {
                const deltaY = e.clientY - startPos;
                // 'top' layout: image is top, drag down increases height
                // 'bottom' layout: image is bottom, drag up increases height
                newSize = pos === 'top' ? startSize + deltaY : startSize - deltaY;
            }

            // Constrain constraints
            const minSize = 250;
            const maxSize = direction === 'horizontal' ? window.innerWidth * 0.8 : window.innerHeight * 0.8;
            newSize = Math.max(minSize, Math.min(newSize, maxSize));

            if (direction === 'horizontal') {
                mediaArea.style.width = `${newSize}px`;
                mediaArea.style.maxWidth = `${newSize}px`;
            } else {
                const mediaContainer = document.getElementById('mediaContainer');
                if (mediaContainer) mediaContainer.style.height = `${newSize}px`;
            }

            appSettings.mediaSize = newSize;
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                mainLayout.classList.remove('is-resizing');
                splitter.classList.remove('is-resizing');

                if (appSettings.mediaSize) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
                }
            }
        });
    }
}

// --- Preview Logic ---
let pendingPreviewFiles = [];
let hasNewLocalImages = false;

async function handleFiles(files) {
    if (!files || files.length === 0) return;

    // Store files and show preview instead of immediate save
    pendingPreviewFiles = Array.from(files).filter(f => f.type.startsWith('image/'));

    if (pendingPreviewFiles.length > 0) {
        renderPreview();
        document.getElementById('previewModal').showModal();
    }
}

function renderPreview() {
    const grid = document.getElementById('previewGrid');
    if (!grid) return;
    grid.innerHTML = '';

    pendingPreviewFiles.forEach(file => {
        const item = document.createElement('div');
        item.className = 'preview-item';
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        // clean up object url later? for preview it's short lived
        item.appendChild(img);
        grid.appendChild(item);
    });
}

function setupPreviewModal() {
    // Add Confirm Add Button
    document.getElementById('btnAddPreview').addEventListener('click', async () => {
        const modal = document.getElementById('previewModal');
        modal.close(); // Close first

        // Actually save
        const results = await localImageDB.addImages(pendingPreviewFiles);
        const count = results.length;
        const lastKey = results[results.length - 1];

        if (count > 0) {
            hasNewLocalImages = true;
            updateLocalMediaUI();

            if (document.getElementById('settingsModal').open) {
                renderLocalImageManager();
            }

            showToast(`${count} 枚の画像を追加しました！`);

            if (lastKey) {
                appState.lastMediaKey = lastKey;
                saveState();
                updateMediaArea('restore');
            }
        }

        pendingPreviewFiles = []; // Clear
    });

    // Cancel Button
    document.getElementById('btnCancelPreview').addEventListener('click', () => {
        pendingPreviewFiles = [];
        document.getElementById('previewModal').close();
    });
}


function initSettings() {
    // Open Modal
    document.getElementById('btnSettings').addEventListener('click', () => {
        // Basic
        const radiosStart = document.querySelectorAll('input[name="startOfWeek"]');
        radiosStart.forEach(r => { if (parseInt(r.value) === appSettings.startOfWeek) r.checked = true; });

        // Auto Layout
        const checkAutoLayout = document.getElementById('checkAutoLayout');
        if (checkAutoLayout) checkAutoLayout.checked = !!appSettings.autoLayoutMode;

        // Media Button State Update
        updateQuickMediaButtons();

        // Interval Settings (Sync Custom UI)
        updateQuickMediaButtons();

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

    // Reset Layout
    document.getElementById('btnResetLayout').addEventListener('click', resetLayoutToDefault);

    // --- Oshi Management Modal ---
    document.getElementById('btnOpenOshiManager').addEventListener('click', openOshiManager);
    document.getElementById('btnCloseOshiManager').addEventListener('click', () => {
        document.getElementById('oshiManagementModal').close();
    });

    // --- Oshi Management Toolbar ---
    document.getElementById('btnOshiAdd').addEventListener('click', () => openOshiEditForm(-1));
    document.getElementById('btnOshiExport').addEventListener('click', handleOshiExport);

    const inputOshiImport = document.getElementById('inputOshiImport');
    document.getElementById('btnOshiImport').addEventListener('click', () => inputOshiImport.click());
    inputOshiImport.addEventListener('change', (e) => {
        handleOshiImportFromModal(e.target.files);
        e.target.value = ''; // Reset for re-selection
    });

    // --- Oshi Edit Form ---
    document.getElementById('btnOshiEditSave').addEventListener('click', saveOshiFromForm);
    document.getElementById('btnOshiEditCancel').addEventListener('click', () => {
        document.getElementById('oshiEditModal').close();
    });

    // --- New Media & Data Handlers ---

    // Local Import (Folder)
    const inputFolder = document.getElementById('inputLocalFolder');
    document.getElementById('btnLocalFolder').addEventListener('click', () => inputFolder.click());
    inputFolder.addEventListener('change', (e) => handleLocalImageImport(e.target.files));

    // Local Import (Files)
    const inputFiles = document.getElementById('inputLocalFiles');
    document.getElementById('btnLocalFiles').addEventListener('click', () => inputFiles.click());
    inputFiles.addEventListener('change', (e) => handleLocalImageImport(e.target.files));

    // Clipboard Paste Helper
    const handleClipboardPaste = async () => {
        try {
            if (!navigator.clipboard || !navigator.clipboard.read) {
                showToast('お使いのブラウザはクリップボードからの画像読み取りに対応していません。', 'warning');
                return;
            }
            const clipboardItems = await navigator.clipboard.read();
            let files = [];
            for (const item of clipboardItems) {
                const imageTypes = item.types.filter(type => type.startsWith('image/'));
                for (const type of imageTypes) {
                    const blob = await item.getType(type);
                    const file = new File([blob], `pasted-${Date.now()}.${type.split('/')[1] || 'png'}`, { type });
                    files.push(file);
                }
            }
            if (files.length > 0) {
                handleLocalImageImport(files); // Reuse preview logic
            } else {
                showToast('クリップボードに画像が見つかりませんでした。', 'warning');
            }
        } catch (err) {
            console.error('Failed to read clipboard:', err);
            showToast('クリップボードの読み取りに失敗しました。権限が許可されているか確認してください。', 'error');
        }
    };

    // Clipboard Paste (Settings)
    const btnClipboardPaste = document.getElementById('btnClipboardPaste');
    if (btnClipboardPaste) {
        btnClipboardPaste.addEventListener('click', handleClipboardPaste);
    }

    // Clipboard Paste (Global)
    const btnGlobalPaste = document.getElementById('btnGlobalPaste');
    if (btnGlobalPaste) {
        btnGlobalPaste.addEventListener('click', handleClipboardPaste);
    }

    // Global Paste Event Listener
    window.addEventListener('paste', (e) => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            const items = (e.clipboardData || window.clipboardData).items;
            let files = [];
            for (let i = 0; i < items.length; i++) {
                if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
                    files.push(items[i].getAsFile());
                }
            }
            if (files.length > 0) {
                e.preventDefault();
                handleLocalImageImport(files);
            }
        }
    });

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

    // --- New: Image Backup/Restore Listeners ---
    inputImportImages.addEventListener('change', (e) => {
        handleImportImages(e.target.files);
        e.target.value = ''; // Reset for re-selection
    });

    // (Legacy cleanup: mediaIntervalSelect listener removed)
}

function loadSettings() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Validation: monthCount must be 1 or 2
            if (parsed.monthCount > 2) {
                parsed.monthCount = 2;
            }
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
            }
            // Clear legacy properties explicitly as they are no longer in DEFAULT_SETTINGS
            delete appSettings.oshiName;
            delete appSettings.oshiBirthday;
            delete appSettings.oshiDebutDay;
            delete appSettings.oshiColor;

            // Fallback for removed 'none' mode
            if (appSettings.mediaMode === 'none') {
                appSettings.mediaMode = 'single';
            }

            // Migration: DHMS interval to preset
            if (!appSettings.mediaIntervalPreset && (appSettings.mediaIntervalRandom || appSettings.mediaIntervalCycle)) {
                const oldSec = appSettings.mediaIntervalRandom || appSettings.mediaIntervalCycle || 60;
                if (oldSec <= 10) appSettings.mediaIntervalPreset = '10s';
                else if (oldSec <= 30) appSettings.mediaIntervalPreset = '30s';
                else if (oldSec <= 60) appSettings.mediaIntervalPreset = '1m';
                else if (oldSec <= 600) appSettings.mediaIntervalPreset = '10m';
                else appSettings.mediaIntervalPreset = '1h';

                // Clean up old settings
                delete appSettings.mediaIntervalRandom;
                delete appSettings.mediaIntervalCycle;
            }

            // Migration: Initialize lastActiveInterval if it doesn't exist
            if (!appSettings.lastActiveInterval) {
                appSettings.lastActiveInterval = appSettings.mediaIntervalPreset || '1m';
            }
        } catch (e) { }
    }
    // updateView(); // Removed to prevent double rendering on init
}

function showToast(message, duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    // Ensure toast container is on top of any open modals using Popover API
    if (container.showPopover) {
        try {
            // Re-stack: hide then show to bring to top of Top Layer
            if (container.matches(':popover-open')) {
                container.hidePopover();
            }
            container.showPopover();
        } catch (e) {
            // Fallback: popover API not supported or error
            console.warn('Popover API not fully supported:', e);
        }
    }

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hiding');
        toast.addEventListener('animationend', () => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        });
    }, duration);
}

/**
 * レイアウト関連の設定（表示月数・レイアウト方向・画像位置・画像サイズ）を
 * デフォルト値にリセットし、UIに反映する。
 */
function resetLayoutToDefault() {
    appSettings.monthCount = DEFAULT_SETTINGS.monthCount;
    appSettings.layoutDirection = DEFAULT_SETTINGS.layoutDirection;
    appSettings.mediaPosition = DEFAULT_SETTINGS.mediaPosition;
    appSettings.mediaSize = null;

    // メディアエリアのインラインスタイルをクリア
    const mediaArea = document.getElementById('mediaArea');
    if (mediaArea) {
        mediaArea.style.width = '';
        mediaArea.style.maxWidth = '';
    }
    const mediaContainer = document.getElementById('mediaContainer');
    if (mediaContainer) {
        mediaContainer.style.height = '';
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
    updateToggleMonthsUI();
    updateLayoutToggleUI();
    updateView();
    showToast('配置をデフォルトに戻しました');
}

function saveSettings() {
    // Basic
    const startOfWeekEl = document.querySelector('input[name="startOfWeek"]:checked');
    if (startOfWeekEl) appSettings.startOfWeek = parseInt(startOfWeekEl.value);

    // Auto Layout
    const checkAutoLayout = document.getElementById('checkAutoLayout');
    if (checkAutoLayout) appSettings.autoLayoutMode = checkAutoLayout.checked;

    // Media mode is managed by UI buttons directly
    // Interval is managed by select menu directly

    // Note: oshiList is already updated in memory via adding/deleting buttons.
    // We just save the current state.

    localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
    document.getElementById('settingsModal').close();
    setupMediaTimer(true); // Reset timer with new settings and refresh image
    updateToggleMonthsUI();
    updateView();
}

/**
 * Updates the active state of Quick Media Mode buttons based on current settings.
 */
function updateQuickMediaButtons() {
    // Legacy support (if any old buttons remain, though we replaced them)
    const mediaModeBtns = document.querySelectorAll('.media-mode-btn:not(.display-mode-btn)');
    mediaModeBtns.forEach(btn => {
        if (btn.getAttribute('data-mode') === appSettings.mediaMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update unified Display Mode Button
    const displayBtn = document.querySelector('.display-mode-btn');
    if (displayBtn) {
        const iconRandom = displayBtn.querySelector('.icon-random');
        const iconCycle = displayBtn.querySelector('.icon-cycle');
        const iconSingle = displayBtn.querySelector('.icon-single');

        if (iconRandom) iconRandom.style.display = appSettings.mediaMode === 'random' ? 'block' : 'none';
        if (iconCycle) iconCycle.style.display = appSettings.mediaMode === 'cycle' ? 'block' : 'none';
        if (iconSingle) iconSingle.style.display = appSettings.mediaMode === 'single' ? 'block' : 'none';

        if (appSettings.mediaMode === 'random') {
            displayBtn.setAttribute('title', '表示モードの設定（現在はランダム中）');
            displayBtn.setAttribute('data-original-title', '表示モードの設定（現在はランダム中）');
        } else if (appSettings.mediaMode === 'cycle') {
            displayBtn.setAttribute('title', '表示モードの設定（現在はサイクル中）');
            displayBtn.setAttribute('data-original-title', '表示モードの設定（現在はサイクル中）');
        } else {
            displayBtn.setAttribute('title', '表示モードの設定（現在は固定中）');
            displayBtn.setAttribute('data-original-title', '表示モードの設定（現在は固定中）');
        }
    }

    updateIntervalMenu();
}

/**
 * Updates the active state of Interval dropdown items based on current settings and mode.
 */
function updateIntervalMenu() {
    const isFixed = appSettings.mediaMode === 'single';

    // Update Mode Items
    const modeItems = document.querySelectorAll('.mode-item');
    modeItems.forEach(item => {
        if (item.getAttribute('data-mode') === appSettings.mediaMode) {
            item.classList.add('is-active');
        } else {
            item.classList.remove('is-active');
        }
    });

    // Update Interval Section State
    const intervalSection = document.querySelector('.interval-section');
    if (intervalSection) {
        if (isFixed) {
            intervalSection.classList.add('disabled');
        } else {
            intervalSection.classList.remove('disabled');
        }
    }

    // Update Interval Items based on lastActiveInterval
    const intervalItems = document.querySelectorAll('.interval-item');
    const targetInterval = isFixed ? null : appSettings.lastActiveInterval;

    intervalItems.forEach(item => {
        if (targetInterval && item.getAttribute('data-value') === targetInterval) {
            item.classList.add('is-active');
        } else {
            item.classList.remove('is-active');
        }
    });
}

/**
 * Checks if the PWA was opened via Web Share Target and loads the shared image.
 */
async function checkSharedImage() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('shared') === 'true') {
        try {
            const cache = await caches.open('shared-image');
            const response = await cache.match('shared-image-file');
            if (response) {
                const blob = await response.blob();
                const file = new File([blob], `shared-${Date.now()}.${blob.type.split('/')[1] || 'png'}`, { type: blob.type });
                handleLocalImageImport([file]); // Pass to preview/import logic
                // Clean up
                await cache.delete('shared-image-file');
            }
            // Remove query param to prevent reload issues
            const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({ path: newUrl }, '', newUrl);
        } catch (error) {
            console.error('Failed to load shared image:', error);
            showToast('共有された画像の読み取りに失敗しました。', 'error');
        }
    }
}

function init() {
    loadSettings();
    loadState(); // Restore last state
    initSettings();
    checkSharedImage();
    setupDragAndDrop();
    setupPreviewModal();

    const dateDisplay = document.getElementById('currentDateDisplay');
    const resetToToday = () => {
        currentRefDate = new Date();
        updateView();
    };

    if (dateDisplay) {
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        dateDisplay.textContent = TODAY.toLocaleDateString('ja-JP', options);
        dateDisplay.addEventListener('click', resetToToday);
    }

    const btnTodayLogo = document.getElementById('btnTodayLogo');
    if (btnTodayLogo) {
        btnTodayLogo.addEventListener('click', resetToToday);
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

    // Unified Display Mode Control logic
    const displayModeBtn = document.querySelector('.display-mode-btn');
    const dropdown = document.querySelector('.interval-dropdown');

    // Move the dropdown to document.body to break out of overflow:hidden containers
    if (dropdown) {
        document.body.appendChild(dropdown);
    }

    if (displayModeBtn) {
        if (displayModeBtn.hasAttribute('title')) {
            displayModeBtn.setAttribute('data-original-title', displayModeBtn.getAttribute('title'));
        }

        displayModeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dropdown) {
                const isOpen = dropdown.classList.contains('is-open');
                if (!isOpen) {
                    // Position the dropdown before showing it
                    const btnRect = e.currentTarget.getBoundingClientRect();
                    dropdown.style.top = `${btnRect.bottom + 8}px`;
                    // Align the right side of the dropdown with the right side of the button
                    dropdown.style.left = 'auto'; // Reset left just in case
                    dropdown.style.right = `${window.innerWidth - btnRect.right}px`;

                    dropdown.classList.add('is-open');
                    e.currentTarget.removeAttribute('title');
                } else {
                    dropdown.classList.remove('is-open');
                    if (e.currentTarget.hasAttribute('data-original-title')) {
                        e.currentTarget.setAttribute('title', e.currentTarget.getAttribute('data-original-title'));
                    }
                }
            }
        });
    }

    const closeAllDropdowns = () => {
        document.querySelectorAll('.interval-dropdown.is-open').forEach(menu => {
            menu.classList.remove('is-open');
            // Check button title attribute restoration (the button is no longer a direct sibling due to body append)
            if (displayModeBtn && displayModeBtn.hasAttribute('data-original-title')) {
                displayModeBtn.setAttribute('title', displayModeBtn.getAttribute('data-original-title'));
            }
        });
    };

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.interval-dropdown') && !e.target.closest('.display-mode-btn')) {
            closeAllDropdowns();
        }
    });

    // Close dropdown when scrolling main layout
    const mainLayout = document.getElementById('mainLayout');
    if (mainLayout) {
        mainLayout.addEventListener('scroll', closeAllDropdowns, { passive: true });
    }
    // Also close on window scroll or resize
    window.addEventListener('scroll', closeAllDropdowns, { passive: true });
    window.addEventListener('resize', closeAllDropdowns, { passive: true });

    // Handle Delegation for Mode Items and Interval Items
    // Because the dropdown is now attached to the body, it won't be caught by quickControls delegation.
    // We must attach an event listener directly to the dropdown or document body.
    if (dropdown) {
        dropdown.addEventListener('click', (e) => {
            const modeItem = e.target.closest('.mode-item');
            const intervalItem = e.target.closest('.interval-item');

            if (modeItem) {
                e.stopPropagation();
                e.preventDefault();

                const mode = modeItem.getAttribute('data-mode');
                if (mode && mode !== appSettings.mediaMode) {
                    if (appSettings.mediaMode === 'single' && (mode === 'random' || mode === 'cycle')) {
                        // Restore interval when leaving single mode
                        appSettings.mediaIntervalPreset = appSettings.lastActiveInterval || '1m';
                    }

                    appSettings.mediaMode = mode;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
                    updateQuickMediaButtons();
                    setupMediaTimer(true);
                    updateView();
                }
            } else if (intervalItem) {
                e.stopPropagation();
                e.preventDefault();

                if (appSettings.mediaMode === 'single') return; // Disabled in single mode

                // Close the dropdown after interval selection
                closeAllDropdowns();

                const val = intervalItem.getAttribute('data-value');
                if (val) {
                    appSettings.mediaIntervalPreset = val;
                    appSettings.lastActiveInterval = val;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
                    updateQuickMediaButtons();
                    setupMediaTimer(false); // Restart timer
                    showToast(`間隔を ${intervalItem.textContent} に設定しました`);
                    updateView();
                }
            }
        });
    }

    const quickControls = document.getElementById('quickMediaControls');
    if (quickControls) {
        quickControls.addEventListener('click', (e) => {
            // modeItem and intervalItem logic moved to the dropdown itself
            // since it was appended to the body
        });
    }
    updateQuickMediaButtons(); // Initialize active state

    // --- Toggle Display Months Button ---
    const btnToggleMonths = document.getElementById('btnToggleMonths');
    if (btnToggleMonths) {
        updateToggleMonthsUI();
        btnToggleMonths.addEventListener('click', () => {
            // 1 -> 2 -> 1
            appSettings.monthCount = (appSettings.monthCount % 2) + 1;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
            updateToggleMonthsUI();
            updateView();
        });
    }

    // --- Toggle Layout Button ---
    const btnToggleLayout = document.getElementById('btnToggleLayout');
    if (btnToggleLayout) {
        updateLayoutToggleUI();
        btnToggleLayout.addEventListener('click', () => {
            appSettings.layoutDirection = appSettings.layoutDirection === 'row' ? 'column' : 'row';
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));

            updateLayoutToggleUI();
            updateView();
        });
    }

    // Cycle check (Refactored to dynamic timer)
    setupMediaTimer(true);
}

/**
 * トグルボタンのSVGテキストを現在のmonthCountに同期する。
 */
function updateToggleMonthsUI() {
    const btn = document.getElementById('btnToggleMonths');
    if (!btn) return;

    if (appSettings.monthCount === 1) {
        // 1ヶ月表示: 1枚のカード
        btn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="5" y="5" width="14" height="14" rx="2" ry="2"></rect>
                <path d="M5 10h14"></path>
            </svg>
        `;
    } else {
        // 2ヶ月表示: 2枚のカードが重なっている
        btn.innerHTML = `
            <svg class="icon-multi-month" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="7" width="14" height="14" rx="2" ry="2" opacity="0.5"></rect>
                <rect x="7" y="3" width="14" height="14" rx="2" ry="2"></rect>
                <path d="M7 10h14" opacity="0.8"></path>
            </svg>
        `;
    }
}

/**
 * レイアウト切替ボタンのSVGアイコンを現在の状況に合わせて変更する。
 */
function updateLayoutToggleUI() {
    const layoutIcon = document.getElementById('layoutIcon');
    if (!layoutIcon) return;

    if (appSettings.layoutDirection === 'row') {
        // 現在：横並び -> 次のクリックで「縦並び」を想起させるアイコン（回転、または向きが異なる長方形）
        layoutIcon.innerHTML = `
            <rect x="3" y="5" width="18" height="6" rx="1.5" fill="currentColor" fill-opacity="0.2"></rect>
            <rect x="3" y="13" width="18" height="6" rx="1.5" fill="currentColor"></rect>
            <path d="M12 2v20" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2" opacity="0.3"></path>
        `;
    } else {
        // 現在：縦並び -> 次のクリックで「横並び」を想起させるアイコン
        layoutIcon.innerHTML = `
            <rect x="5" y="3" width="6" height="18" rx="1.5" fill="currentColor" fill-opacity="0.2"></rect>
            <rect x="13" y="3" width="6" height="18" rx="1.5" fill="currentColor"></rect>
            <path d="M2 12h20" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2" opacity="0.3"></path>
        `;
    }
}

let mediaTimer = null;
let currentCycleIndex = -1;

function setupMediaTimer(isInit = false) {
    if (mediaTimer) {
        clearInterval(mediaTimer);
        clearTimeout(mediaTimer);
        mediaTimer = null;
    }

    if (isInit) {
        updateMediaArea('restore');
    }

    if (appSettings.mediaMode === 'single') return;

    const preset = appSettings.mediaIntervalPreset || '1m';
    if (preset === 'startup') return;

    // --- Case 1: Fixed Interval (s, m, h) ---
    if (preset.includes('s') || preset.includes('m') || preset.includes('h')) {
        let seconds = 60;
        if (preset === '10s') seconds = 10;
        else if (preset === '30s') seconds = 30;
        else if (preset === '1m') seconds = 60;
        else if (preset === '10m') seconds = 600;
        else if (preset === '1h') seconds = 3600;

        mediaTimer = setInterval(() => {
            updateMediaArea('advance');
        }, seconds * 1000);
    }
    // --- Case 2: Specific Time (H:MM) ---
    else if (preset.includes(':')) {
        const scheduleNext = () => {
            const [targetH, targetM] = preset.split(':').map(Number);
            const now = new Date();
            const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetH, targetM, 0, 0);

            // If target time has already passed today, set for tomorrow
            if (target <= now) {
                target.setDate(target.getDate() + 1);
            }

            const diff = target - now;

            mediaTimer = setTimeout(() => {
                updateMediaArea('advance');
                scheduleNext(); // Recursive for next day
            }, diff);
        };

        scheduleNext();
    }
}

if (typeof document !== 'undefined') { document.addEventListener('DOMContentLoaded', init); }

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered.'))
            .catch(err => console.log('Service Worker registration failed.', err));
    });
}

// --- Media Logic ---
let currentMediaObjectURL = null;

/**
 * プレースホルダーを削除し、コンテンツレイヤーを作成・取得する
 * @param {HTMLElement} container メディアコンテナ
 * @returns {HTMLElement} コンテンツレイヤー
 */
function prepareMediaContentLayer(container) {
    let contentLayer = container.querySelector('.media-content-layer');
    if (!contentLayer) {
        // Remove placeholder instead of full reset to preserve drag handle
        const placeholder = container.querySelector('.media-placeholder');
        if (placeholder) placeholder.remove();

        contentLayer = document.createElement('div');
        contentLayer.className = 'media-content-layer';
        contentLayer.style.width = '100%';
        contentLayer.style.height = '100%';
        contentLayer.style.display = 'flex';
        contentLayer.style.alignItems = 'center';
        contentLayer.style.justifyContent = 'center';
        container.appendChild(contentLayer);
    }
    return contentLayer;
}

/**
 * 手動ナビゲーションボタン（前後）の描画・削除を行う
 * @param {HTMLElement} contentLayer コンテンツレイヤー
 * @param {Function} handleNavigation ナビゲーション処理関数
 */
function updateMediaNavigation(contentLayer, handleNavigation) {
    if (appSettings.mediaMode === 'random' || appSettings.mediaMode === 'cycle') {
        if (!contentLayer.querySelector('.media-nav-btn.prev')) {
            const btnPrev = document.createElement('div');
            btnPrev.className = 'media-nav-btn prev';
            btnPrev.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
            btnPrev.onclick = (e) => { e.stopPropagation(); handleNavigation('prev'); };
            contentLayer.appendChild(btnPrev);
        }
        if (!contentLayer.querySelector('.media-nav-btn.next')) {
            const btnNext = document.createElement('div');
            btnNext.className = 'media-nav-btn next';
            btnNext.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
            btnNext.onclick = (e) => { e.stopPropagation(); handleNavigation('next'); };
            contentLayer.appendChild(btnNext);
        }
    } else {
        // Remove valid buttons if mode changed to single/none
        const existing = contentLayer.querySelectorAll('.media-nav-btn');
        existing.forEach(el => el.remove());
    }
}

/**
 * 画像・動画を表示するためのディスプレイエリアを作成・取得する
 * @param {HTMLElement} contentLayer コンテンツレイヤー
 * @returns {HTMLElement} ディスプレイエリア
 */
function getOrCreateMediaDisplayArea(contentLayer) {
    let displayArea = contentLayer.querySelector('.media-display-area');
    if (!displayArea) {
        displayArea = document.createElement('div');
        displayArea.className = 'media-display-area';
        displayArea.style.width = '100%';
        displayArea.style.height = '100%';
        displayArea.style.display = 'flex';
        displayArea.style.alignItems = 'center';
        displayArea.style.justifyContent = 'center';
        contentLayer.appendChild(displayArea);
    }
    return displayArea;
}

/**
 * 次に表示するメディアのキーを決定する
 * @param {string[]} keys ローカルDBのキー配列
 * @param {string} mode 更新モード('advance', 'restore', 'prev', 'next')
 * @returns {string|null} 対象のキー
 */
function determineTargetMediaKey(keys, mode) {
    let targetKey = null;

    if (mode === 'restore' && appState.lastMediaKey && keys.includes(appState.lastMediaKey)) {
        // Restore last state on boot
        targetKey = appState.lastMediaKey;

        // Sync index if in cycle mode
        if (appSettings.mediaMode === 'cycle') {
            currentCycleIndex = keys.indexOf(targetKey);
        }

        // Re-initialize history if empty but we have a restore key
        if (appState.mediaHistory.length === 0) {
            appState.mediaHistory = [targetKey];
            appState.mediaHistoryIndex = 0;
        } else {
            // If history exists, ensure index is valid
            if (appState.mediaHistoryIndex === -1 || appState.mediaHistoryIndex >= appState.mediaHistory.length) {
                appState.mediaHistoryIndex = appState.mediaHistory.length - 1;
            }
        }

    } else if (mode === 'prev') {
        // --- Previous Action ---
        if (appSettings.mediaMode === 'random') {
            if (appState.mediaHistoryIndex > 0) {
                appState.mediaHistoryIndex--;
                targetKey = appState.mediaHistory[appState.mediaHistoryIndex];
            } else {
                // Start of history
                targetKey = appState.mediaHistory[0];
            }
        } else if (appSettings.mediaMode === 'cycle') {
            // Simple decrement
            if (currentCycleIndex === -1) currentCycleIndex = 0;
            currentCycleIndex = (currentCycleIndex - 1 + keys.length) % keys.length;
            targetKey = keys[currentCycleIndex];
        }

    } else if (mode === 'next' || mode === 'advance') {
        // --- Next/Advance Action ---

        if (appSettings.mediaMode === 'random') {
            // Check if we are browsing history
            if (appState.mediaHistoryIndex < appState.mediaHistory.length - 1) {
                // Move forward in history
                appState.mediaHistoryIndex++;
                targetKey = appState.mediaHistory[appState.mediaHistoryIndex];
            } else {
                // Generate NEW random
                let nextKey;
                let attempts = 0;
                do {
                    nextKey = keys[Math.floor(Math.random() * keys.length)];
                    attempts++;
                } while (nextKey === appState.lastMediaKey && keys.length > 1 && attempts < 5);

                targetKey = nextKey;

                // Push to history
                appState.mediaHistory.push(targetKey);
                appState.mediaHistoryIndex = appState.mediaHistory.length - 1;

                // Limit history size
                if (appState.mediaHistory.length > 50) {
                    appState.mediaHistory.shift();
                    appState.mediaHistoryIndex--;
                }
            }

        } else if (appSettings.mediaMode === 'cycle') {
            // State-based rotation
            if (currentCycleIndex === -1) {
                currentCycleIndex = 0;
            } else {
                currentCycleIndex = (currentCycleIndex + 1) % keys.length;
            }
            targetKey = keys[currentCycleIndex];
        } else if (appSettings.mediaMode === 'single') {
            targetKey = keys[0];
        }
    } else {
        // Fallback/Default
        if (keys.length > 0) targetKey = keys[0];
    }

    return targetKey;
}

/**
 * デフォルトの画像を描画する
 * @param {HTMLElement} displayArea ディスプレイエリア
 */
function renderDefaultMedia(displayArea) {
    displayArea.innerHTML = '';
    const defaultImg = document.createElement('img');
    defaultImg.alt = "Default Image";
    defaultImg.style.cssText = 'width:100%; height:100%; object-fit:contain;';

    // Apply auto layout even for default image
    defaultImg.onload = () => {
        applyAutoLayout(defaultImg);
    };
    defaultImg.src = 'src/assets/default_image.png';

    displayArea.appendChild(defaultImg);
}

/**
 * 画像や動画などのメディアレコードを描画する
 * @param {Object} record ローカルDBから取得したメディア情報
 * @param {HTMLElement} displayArea ディスプレイエリア
 */
function renderMediaRecord(record, displayArea) {
    currentMediaObjectURL = URL.createObjectURL(record.file || record); // Handle File object safely

    // Determine content type
    const mime = (record.file ? record.file.type : record.type) || 'image/png';

    // Important: DO NOT clear contentLayer entirely, as it contains nav buttons and displayArea.
    // Clear ONLY the displayArea content.
    if (displayArea) {
        displayArea.innerHTML = '';
    }

    if (mime.startsWith('image/')) {
        // Create Background Layer (Blur)
        const backdrop = document.createElement('img');
        backdrop.className = 'media-backdrop';
        backdrop.src = currentMediaObjectURL;

        // Create Main Image Layer
        const mainImg = document.createElement('img');
        mainImg.className = 'media-main-img';
        mainImg.alt = "Oshi Media";

        // Aspect Ratio Detection & Auto Layout - Set handler BEFORE src
        mainImg.onload = () => {
            applyAutoLayout(mainImg);
        };
        mainImg.src = currentMediaObjectURL;

        if (displayArea) {
            displayArea.appendChild(backdrop);
            displayArea.appendChild(mainImg);
        }
    } else if (mime.startsWith('video/')) {
        const video = document.createElement('video');
        video.src = currentMediaObjectURL;
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';
        if (displayArea) {
            displayArea.appendChild(video);
        }
    }
}

async function updateMediaArea(mode = 'advance') { // Changed to mode: 'advance'|'restore'|'layout'
    const area = document.getElementById('mediaArea');
    const container = document.getElementById('mediaContainer');
    if (!area || !container) return;

    area.style.display = 'block';
    adjustMediaLayout();

    if (mode === 'layout') return; // Stop here if only layout update is requested

    // Clean up previous ObjectURL if exists
    if (currentMediaObjectURL) {
        URL.revokeObjectURL(currentMediaObjectURL);
        currentMediaObjectURL = null;
    }

    // Prepare Container Structure (Content Layer + UI Layer)
    const contentLayer = prepareMediaContentLayer(container);

    // --- Manual Navigation Logic ---
    const handleNavigation = async (direction) => { // 'next' or 'prev'
        await updateMediaArea(direction === 'next' ? 'next' : 'prev');

        // Reset timer if it's an interval-based preset to prevent immediate switch
        const preset = appSettings.mediaIntervalPreset || '1m';
        if (preset.includes('s') || preset.includes('m') || preset.includes('h')) {
            setupMediaTimer(false);
        }
    };

    // Render Navigation Buttons (if not present)
    updateMediaNavigation(contentLayer, handleNavigation);

    // Helper to get or create image display area (to preserve buttons)
    const displayArea = getOrCreateMediaDisplayArea(contentLayer);

    // --- Logic: Local Only ---
    try {
        const keys = await localImageDB.getAllKeys();
        if (keys.length === 0) {
            renderDefaultMedia(displayArea);
            return;
        }

        const targetKey = determineTargetMediaKey(keys, mode);

        // Save State
        if (targetKey) {
            appState.lastMediaKey = targetKey;
            saveState();

            const record = await localImageDB.getImage(targetKey);
            if (record) {
                renderMediaRecord(record, displayArea);
            }
        }
    } catch (e) {
        console.error("Error in updateMediaArea:", e);
        if (displayArea) {
            displayArea.innerHTML = '<p class="media-placeholder">画像の読み込みエラー</p>';
        }
    }
}

/**
 * 画像のアスペクト比を判定し、おまかせモードならレイアウトを自動調整する。
 * @param {HTMLImageElement} img 判定対象の画像エレメント
 */
function applyAutoLayout(img) {
    if (!appSettings.autoLayoutMode) return;

    const w = img.naturalWidth;
    const h = img.naturalHeight;

    if (w === 0 || h === 0) {
        console.warn(`[AutoLayout] Image dimensions are zero (${w}x${h}). Skipping adjustment.`);
        return;
    }

    const ratio = w / h;
    const invRatio = h / w;

    let changed = false;
    if (ratio >= 1.2) {
        // Landscape -> Top Photo + Row Calendar
        if (appSettings.mediaPosition !== 'top' || appSettings.layoutDirection !== 'row') {
            appSettings.mediaPosition = 'top';
            appSettings.layoutDirection = 'row';
            changed = true;
        }
    } else if (invRatio >= 1.2) {
        // Portrait -> Left Photo + Column Calendar
        if (appSettings.mediaPosition !== 'left' || appSettings.layoutDirection !== 'column') {
            appSettings.mediaPosition = 'left';
            appSettings.layoutDirection = 'column';
            changed = true;
        }
    } else {
        // Default/Square -> Standard Top + Row
        if (appSettings.mediaPosition !== 'top' || appSettings.layoutDirection !== 'row') {
            appSettings.mediaPosition = 'top';
            appSettings.layoutDirection = 'row';
            changed = true;
        }
    }

    if (changed) {
        saveSettingsSilently();
        updateLayoutToggleUI();
        updateView(); // Re-render everything with new layout classes
    }
}

/**
 * Saves settings to localStorage without closing the modal or showing toast.
 */
function saveSettingsSilently() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
}

function adjustMediaLayout() {
    const area = document.getElementById('mediaArea');
    const container = document.getElementById('mediaContainer');
    if (!area || !container) return;

    // Reset manual styles first, except if we have a saved size that overrides default
    area.style.width = '';
    area.style.maxWidth = '';
    container.style.height = '';

    // Mobile Override
    if (window.innerWidth <= 768) {
        area.style.width = '100%';
        area.style.maxWidth = '100%';
        container.style.height = 'auto';
        return;
    }

    const pos = appSettings.mediaPosition || 'right';
    const header = document.querySelector('.header');

    // スプリッターの表示/非表示調整等
    const splitter = document.getElementById('layoutSplitter');
    if (splitter) {
        splitter.style.display = 'flex'; // Reset splitter state
    }

    // Gaps estimate: Header Margin (24) + Layout Gap (24) + Padding (40) + Safety (20)
    // Adjusted to ensure bottom margin
    const gaps = 110;

    if (pos === 'top' || pos === 'bottom') {
        // --- Top/Bottom: Full Width (Centered) & Dynamic Height ---

        // Width: Match total calendar width
        let targetWidth = 550;
        if (appSettings.layoutDirection === 'row') {
            targetWidth = (550 * appSettings.monthCount) + (24 * (appSettings.monthCount - 1));
        }
        area.style.width = `${targetWidth}px`;
        area.style.maxWidth = '95vw';

        // Height: Fit to Remaining Window OR Use Saved Size
        if (appSettings.mediaSize) {
            container.style.height = `${appSettings.mediaSize}px`;
        } else {
            const calendarSection = document.querySelector('.calendar-section');
            if (calendarSection) {
                const calendarH = calendarSection.offsetHeight;
                const availableH = window.innerHeight - calendarH - gaps;

                // Minimum 250px
                container.style.height = `${Math.max(250, availableH)}px`;
            }
        }

    } else {
        // --- Left/Right: Fixed Width & Full Available Height ---

        // Width: Use Saved Size or Fixed 550px
        const currentWidth = appSettings.mediaSize || 550;
        area.style.width = `${currentWidth}px`;
        area.style.maxWidth = `${currentWidth}px`;

        // Height: Expand to fill available screen height (minimum matching calendar)
        // Decoupled from strict calendar height synchronization
        const calendarWrapper = document.getElementById('calendarWrapper');
        let minHeight = 400;
        if (calendarWrapper) {
            minHeight = calendarWrapper.offsetHeight;
        }

        const availableH = window.innerHeight - 100; // body padding + safety
        container.style.height = `${Math.max(minHeight, availableH)}px`;
    }
}



if (typeof window !== 'undefined') { window.addEventListener('resize', adjustMediaLayout); }

// script ends here

// --- Exports for Testing ---
/** @export */
window.appSettings = appSettings;
/** @export */
window.renderCalendar = renderCalendar;
/** @export */
window.escapeHTML = escapeHTML;
/** @export */
window.getContrastColor = getContrastColor;
/** @export */
window.parseDateString = parseDateString;
/** @export */
window.getWeekdayHeaderHTML = getWeekdayHeaderHTML;
/** @export */
window.getJPHoliday = getJPHoliday;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        appSettings,
        renderCalendar,
        escapeHTML,
        getContrastColor,
        parseDateString,
        getWeekdayHeaderHTML,
        getJPHoliday
    };
}

// Fallback for Vitest when loaded directly without transpilation matching standard browser env
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    // Prevent throw when `export` is encountered in a standard script context inside E2E browsers.
    // E2E UI testing uses standard scripts.
    try {
        if (typeof module !== 'undefined' && module.exports) {
            // We are in node tests, vitest can use module.exports
        }
    } catch (e) { }
} else if (typeof exports !== 'undefined' && typeof window === 'undefined') {
    // Only throw exports in node-like environments that are expecting it. E2E browser environments
    // running via <script src="script.js"> will throw SyntaxError on export.
} else {
    // We don't export in browser explicitly using ESM export token to avoid syntax errors.
    // Instead we rely on window.* that are populated above.
}
