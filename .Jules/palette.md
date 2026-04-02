## 2024-04-03 - Missing aria-labels on dynamically created icon buttons
**Learning:** Dynamically created inline navigation buttons (like `.month-nav-prev` using '‹') are prone to missing accessibility attributes, causing poor screen reader experience for core calendar navigation.
**Action:** Always add `aria-label` to dynamically created mobile calendar month navigation buttons in `src/script.js` to ensure proper screen reader support for month switching.
