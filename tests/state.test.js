import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractCode, loadModule, setupTestEnvironment } from './test-utils.js';

// Ensure test environment is setup
setupTestEnvironment();

// Extract state logic from script.js
const stateLogic = extractCode('// --- State Persistence (Separate from Settings) ---', '// Helper: Get Contrast Color (Black or White)');

// We need to return appState as a function to always get the current reference
// since loadState updates the let appState variable within its scope.
const setupCode = `
    ${stateLogic}
    return {
        getAppState: () => appState,
        setAppState: (newState) => { appState = newState; },
        loadState,
        saveState,
        STATE_KEY
    };
`;
const moduleCode = new Function(setupCode);

describe('State Persistence', () => {
    let getAppState, setAppState, loadState, saveState, STATE_KEY;

    beforeEach(() => {
        // Mock localStorage functions using vi.fn()
        global.localStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn()
        };

        // Reload module to reset state
        const exports = moduleCode();
        getAppState = exports.getAppState;
        setAppState = exports.setAppState;
        loadState = exports.loadState;
        saveState = exports.saveState;
        STATE_KEY = exports.STATE_KEY;

        // Mock console.error to prevent cluttering test output
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('loadState', () => {
        it('should load state from localStorage', () => {
            const mockState = {
                lastMediaKey: 123,
                mediaHistory: [1, 2, 3],
                mediaHistoryIndex: 2
            };
            localStorage.getItem.mockReturnValue(JSON.stringify(mockState));

            loadState();

            expect(localStorage.getItem).toHaveBeenCalledWith(STATE_KEY);
            expect(getAppState()).toEqual(mockState);
        });

        it('should handle missing localStorage value gracefully', () => {
            localStorage.getItem.mockReturnValue(null);

            const initialState = getAppState();
            loadState();

            expect(getAppState()).toEqual(initialState);
        });

        it('should handle invalid JSON gracefully', () => {
            localStorage.getItem.mockReturnValue('invalid json');

            const initialState = getAppState();
            loadState();

            expect(console.error).toHaveBeenCalledWith('Failed to load state', expect.any(SyntaxError));
            expect(getAppState()).toEqual(initialState);
        });

        it('should handle localStorage.getItem throwing an error gracefully', () => {
            const error = new Error('localStorage is disabled');
            localStorage.getItem.mockImplementation(() => {
                throw error;
            });

            const initialState = getAppState();
            loadState();

            expect(console.error).toHaveBeenCalledWith('Failed to load state', error);
            expect(getAppState()).toEqual(initialState);
        });

        it('should merge loaded state with existing state', () => {
            const loadedState = { lastMediaKey: 456 };
            localStorage.getItem.mockReturnValue(JSON.stringify(loadedState));

            setAppState({ ...getAppState(), someOtherKey: 'value' });

            loadState();

            const currentState = getAppState();
            expect(currentState.lastMediaKey).toBe(456);
            expect(currentState.someOtherKey).toBe('value');
            // Check default initializations
            expect(currentState.mediaHistory).toEqual([]);
            expect(currentState.mediaHistoryIndex).toBe(-1);
        });

        it('should initialize mediaHistory and mediaHistoryIndex if missing from loaded state', () => {
             const loadedState = { lastMediaKey: 789 }; // Missing mediaHistory properties
             localStorage.getItem.mockReturnValue(JSON.stringify(loadedState));

             loadState();

             const currentState = getAppState();
             expect(currentState.mediaHistory).toEqual([]);
             expect(currentState.mediaHistoryIndex).toBe(-1);
        });
    });

    describe('saveState', () => {
        it('should save current state to localStorage', () => {
            saveState();

            expect(localStorage.setItem).toHaveBeenCalledWith(
                STATE_KEY,
                JSON.stringify(getAppState())
            );
        });

        it('should handle localStorage.setItem throwing an error gracefully', () => {
            const error = new Error('Quota exceeded');
            localStorage.setItem.mockImplementation(() => {
                throw error;
            });

            saveState();

            expect(console.error).toHaveBeenCalledWith('Failed to save state', error);
        });
    });
});
