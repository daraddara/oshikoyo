## 2026-03-23 - Add ARIA Label to Tag Removal Button
**Learning:** Dynamically created icon-only buttons (like `document.createElement("button")` with `textContent = "×"`) lack semantic context, making them invisible or unclear to screen readers.
**Action:** Always set `aria-label` when creating icon-only buttons via JS to ensure they are fully accessible.
