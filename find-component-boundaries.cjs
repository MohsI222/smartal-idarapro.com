const fs = require('fs');

const content = fs.readFileSync('/Users/macbookair/smart-al-idara-pro/src/components/hr/HrEnterpriseSuite.tsx', 'utf8');

const lines = content.split('\n');

// Find all function definitions
const functions = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].match(/^(export )?function /)) {
    functions.push({ line: i + 1, name: lines[i].trim() });
  }
}

console.log('=== Function definitions ===');
functions.forEach(f => {
  console.log(`Line ${f.line}: ${f.name}`);
});

// Find the export default
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('export default')) {
    console.log(`\nExport default at line ${i + 1}: ${lines[i].trim()}`);
  }
}
