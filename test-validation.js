const fs = require('fs');

const scriptContent = fs.readFileSync('./src/script.js', 'utf-8');
const validateCodeMatch = scriptContent.match(/function validateImportedSettings\(data\) \{([\s\S]*?)\}\n\/\/ --- Validation Logic End ---/);

if (validateCodeMatch) {
    const validateFunc = new Function('data', validateCodeMatch[1]);

    // Simulate validation
    const result = validateFunc({ monthCount: 1, oshiList: [] });
    console.log(result);
} else {
    console.log("Could not extract function");
}
