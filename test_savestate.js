import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractCode, loadModule, setupTestEnvironment } from './tests/test-utils.js';

setupTestEnvironment();

const stateLogic = extractCode('const STATE_KEY = \'oshikoyo_state\';', '// Helper: Get Contrast Color');
const { loadState, saveState, appState, STATE_KEY } = loadModule([
    "let appState = { lastMediaKey: null, mediaHistory: [], mediaHistoryIndex: -1 };",
    "const STATE_KEY = 'oshikoyo_state';",
    stateLogic.replace(/const STATE_KEY = 'oshikoyo_state';/, '').replace(/let appState = [^;]+;/, '')
], ['loadState', 'saveState', 'appState', 'STATE_KEY']);

console.log({appState, STATE_KEY});
