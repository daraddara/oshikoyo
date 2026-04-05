## 2024-05-30 - CSP Violation in Update Notification
**Vulnerability:** Inline `onclick="window.location.reload()"` used in `showUpdateNotification` which violates strict Content Security Policy (`unsafe-inline`).
**Learning:** Even simple utility functions like update toasts can inadvertently introduce XSS attack surfaces or break under strict CSPs if inline event handlers are used instead of proper event listeners.
**Prevention:** Always use `addEventListener` on constructed DOM elements or `document.createElement` when building dynamic UI components, strictly avoiding inline HTML event handler attributes (`onclick`, `onmouseover`, etc.).

## 2024-05-30 - Type Coercion Missing in HTML Escaping
**Vulnerability:** `escapeHTML` assumed input was always a String. Passing objects or numbers could lead to `TypeError`, causing a potential client-side Denial of Service (rendering crash) on unexpected payload types.
**Learning:** Utility functions handling external or untyped data in plain JavaScript must explicitly enforce type coercion (e.g. `String(str)`) before calling string-specific methods like `.replace()`.
**Prevention:** Always cast inputs to Strings or rigorously validate parameter types before executing regex operations in sanitization utilities.
