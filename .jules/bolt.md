
## 2024-05-24 - High-Frequency Array Cloning in getters
**Learning:** `getImageTags` uses defensive array cloning `[...meta[imgId].tags]` and returns new empty arrays `[]` on every call. It's used heavily in loops and filters (e.g. `renderLocalImageManager`, `getEffectiveImagePool`), leading to massive garbage collection pressure and performance degradation.
**Action:** Use a frozen empty array `const EMPTY_TAGS = Object.freeze([]);` for defaults and return references to the original arrays `meta[imgId]?.tags || EMPTY_TAGS` instead of spreading them. Since `getImageTags` callers typically only iterate or read lengths, returning references avoids allocation overhead.
