## 2025-02-19 - Memoize pure functions executed frequently within loops
**Learning:** Pure functions executed frequently within loops (e.g., `parseDateString`, `getContrastColor`, `hexToRgba`) can cause unnecessary performance overhead due to redundant regex execution and string manipulation.
**Action:** Memoize their return values using a `Map` cache to avoid redundant computation, significantly improving rendering performance in the O(1) daily loops.
