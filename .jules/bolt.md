## 2024-05-24 - [Optimize Calendar Rendering]
**Learning:** O(N*M) nested loop inside day-iteration in `renderCalendar` caused extreme slowness with many Oshis and memorial dates. Looping over all Oshis for every single day in the month re-calculating matches and event type labels was a major bottleneck.
**Action:** Pre-calculate `eventsByDay` outside the 31-day loop using a Map or Array grouping to achieve O(1) daily rendering. Use a Map for `appSettings.event_types` to avoid `.find` lookups.
