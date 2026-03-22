## 2024-03-22 - Add ARIA Labels to Dynamically Generated Icon-only Buttons
**Learning:** Icon-only buttons (like edit, delete, or close buttons) created dynamically via JavaScript `document.createElement()` often miss critical accessibility attributes because developers tend to rely solely on the `title` attribute for visual tooltips.
**Action:** When reviewing dynamic DOM elements, always verify that interactive elements lacking visible text have explicit `aria-label` attributes set via `element.setAttribute('aria-label', '...')` to ensure screen reader users receive proper context.
