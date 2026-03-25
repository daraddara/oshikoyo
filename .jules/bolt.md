## 2025-02-23 - Avoid Defensive Array Cloning in High-Frequency Getters
**Learning:** Returning `[...array]` from a getter (like `getImageTags`) creates massive GC pressure when called inside loops (like `renderLocalImageManager` processing thousands of images). Returning a new empty `[]` array also causes unnecessary allocations.
**Action:** Return the array reference directly if mutation isn't a concern, or use `Object.freeze([])` to return a shared empty array constant for missing properties to avoid O(N) allocations in rendering loops.
