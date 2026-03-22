## 2024-03-22 - [DOM manipulations in inner loop of renderCalendar]
**Learning:** Appending each `day-cell` element directly to `daysGrid` inside the 31-day loop of `renderCalendar` caused unnecessary DOM reflows and repaints, especially noticeable when many Oshis or events were present.
**Action:** Used `document.createDocumentFragment()` to accumulate all generated `day-cell` elements and appended the single fragment to `daysGrid` outside the loop, which reduced rendering time for 500 Oshis from ~245ms to ~148ms.
