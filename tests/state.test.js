// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractCode, loadModule, setupTestEnvironment } from './test-utils.js';

// Setup basic environment to provide localStorage mocks
setupTestEnvironment();

// Extract the persistence logic from script.js
const stateLogic = extractCode('// --- State Persistence (Separate from Settings) ---', '// Helper: Get Contrast Color (Black or White)');

// We need to inject the extracted logic into an environment where 'appState' and 'STATE_KEY' are exposed.
// Because appState is modified inside loadState, we need it to be accessible or we return it.
const combinedCode = `
    ${stateLogic}
    return {
        loadState,
        saveState,
        getAppState: () => appState,
        setAppState: (newState) => { appState = newState; },
        getSTATE_KEY: () => STATE_KEY
    };
`;
const moduleCode = new Function(combinedCode)();
const { loadState, saveState, getAppState, setAppState, getSTATE_KEY } = moduleCode;

describe('State Persistence', () => {
    const STATE_KEY = getSTATE_KEY();
    const defaultState = {
        lastMediaKey: null,
        mediaHistory: [],
        mediaHistoryIndex: -1
    };

    beforeEach(() => {
        // Reset state before each test
        setAppState({ ...defaultState });
        vi.clearAllMocks();

        global.localStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn()
        };
        // Clear any previous error logs
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('saveState', () => {
        it('should save the current appState to localStorage', () => {
            const testState = {
                lastMediaKey: 'test-key',
                mediaHistory: ['test-key'],
                mediaHistoryIndex: 0
            };
            setAppState(testState);

            saveState();

            expect(global.localStorage.setItem).toHaveBeenCalledWith(STATE_KEY, JSON.stringify(testState));
            expect(console.error).not.toHaveBeenCalled();
        });

        it('should handle QuotaExceededError gracefully and log an error', () => {
            const error = new Error('QuotaExceededError: DOM Exception 22');
            global.localStorage.setItem.mockImplementationOnce(() => {
                throw error;
            });

            const testState = {
                lastMediaKey: 'test-key-2',
                mediaHistory: ['test-key-2'],
                mediaHistoryIndex: 0
            };
            setAppState(testState);

            // This should not throw an exception, but catch it and log it
            expect(() => saveState()).not.toThrow();

            expect(global.localStorage.setItem).toHaveBeenCalledWith(STATE_KEY, JSON.stringify(testState));
            expect(console.error).toHaveBeenCalledWith('Failed to save state', error);
        });
    });

    describe('loadState', () => {
        it('should load state from localStorage and merge it with current appState', () => {
            const savedState = {
                lastMediaKey: 'loaded-key',
                mediaHistory: ['loaded-key'],
                mediaHistoryIndex: 0
            };
            global.localStorage.getItem.mockReturnValueOnce(JSON.stringify(savedState));

            loadState();

            expect(global.localStorage.getItem).toHaveBeenCalledWith(STATE_KEY);
            const currentState = getAppState();
            expect(currentState.lastMediaKey).toBe('loaded-key');
            expect(currentState.mediaHistory).toEqual(['loaded-key']);
            expect(currentState.mediaHistoryIndex).toBe(0);
        });

        it('should not modify appState if localStorage is empty', () => {
            global.localStorage.getItem.mockReturnValueOnce(null);

            loadState();

            expect(global.localStorage.getItem).toHaveBeenCalledWith(STATE_KEY);
            const currentState = getAppState();
            expect(currentState).toEqual(defaultState);
        });

        it('should handle missing mediaHistory or mediaHistoryIndex safely when loading', () => {
            const savedState = {
                lastMediaKey: 'partial-key'
            };
            global.localStorage.getItem.mockReturnValueOnce(JSON.stringify(savedState));

            loadState();

            const currentState = getAppState();
            expect(currentState.lastMediaKey).toBe('partial-key');
            // Missing properties should be initialized
            expect(currentState.mediaHistory).toEqual([]);
            expect(currentState.mediaHistoryIndex).toBe(-1);
        });

        it('should handle invalid JSON gracefully and log an error', () => {
            global.localStorage.getItem.mockReturnValueOnce('invalid-json');

            // This should not throw, but catch and log
            expect(() => loadState()).not.toThrow();

            expect(global.localStorage.getItem).toHaveBeenCalledWith(STATE_KEY);

            // Should be logged as syntax error
            expect(console.error).toHaveBeenCalled();
            expect(console.error.mock.calls[0][0]).toBe('Failed to load state');
            expect(console.error.mock.calls[0][1]).toBeInstanceOf(SyntaxError);

            // State should remain unchanged
            expect(getAppState()).toEqual(defaultState);
        });

        it('should handle getItem throwing an error gracefully', () => {
            const error = new Error('Access Denied');
            global.localStorage.getItem.mockImplementationOnce(() => {
                throw error;
            });

            expect(() => loadState()).not.toThrow();

            expect(console.error).toHaveBeenCalledWith('Failed to load state', error);
            expect(getAppState()).toEqual(defaultState);
        });
    });
});
