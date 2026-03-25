## 2026-03-24 - Memory Leaks with Object URLs in SPAs
**Learning:** `URL.createObjectURL()` strings act as GC roots for Blob/File objects. If DOM elements containing these URLs are removed via `innerHTML = ''` without first calling `URL.revokeObjectURL()`, the underlying Blob remains in memory indefinitely, causing massive memory leaks in list-rendering loops.
**Action:** Always query and iterate over `img` elements to call `URL.revokeObjectURL(img.src)` BEFORE overwriting their container with `innerHTML = ''`.
