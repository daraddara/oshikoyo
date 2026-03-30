## 2024-05-19 - Mitigate CSV Injection (Formula Injection)
**Vulnerability:** User input exported to CSV files can contain values starting with `=, +, -, or @`. When opened in spreadsheet applications like Excel, these values are interpreted as formulas, leading to CSV Injection (also known as Formula Injection). This can result in arbitrary command execution or data exfiltration.
**Learning:** The `escapeCsvField` function in `src/script.js` was properly handling commas, double quotes, and newlines but missing protection against formula injection triggers.
**Prevention:** Always prepend a single quote (`'`) to any CSV field that begins with `=`, `+`, `-`, or `@` to force the spreadsheet application to interpret the cell as text instead of a formula.
