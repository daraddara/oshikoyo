## 2024-03-29 - Settings Modal WAI-ARIA Tab Pattern
**Learning:** The settings interface (`.settings-tabs`) relies on a visual tab pattern but lacks the requisite WAI-ARIA properties, making keyboard and screen reader navigation confusing.
**Action:** When implementing or updating tabbed interfaces, ensure `role="tab"`, `aria-selected`, and `aria-controls` are present on tab buttons, and `role="tabpanel"` and `aria-labelledby` are on corresponding panels. Furthermore, ensure JavaScript toggles `aria-selected` dynamically.
