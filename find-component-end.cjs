const fs = require('fs');

const content = fs.readFileSync('/Users/macbookair/smart-al-idara-pro/src/components/hr/HrEnterpriseSuite.tsx', 'utf8');

const lines = content.split('\n');

// Find the main component function
let mainComponentStart = -1;
let mainComponentEnd = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('export function HrEnterpriseSuite')) {
    mainComponentStart = i;
    console.log(`Main component starts at line ${i + 1}`);
    break;
  }
}

// Find where the Field function starts
let fieldFunctionStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function Field({')) {
    fieldFunctionStart = i;
    console.log(`Field function starts at line ${i + 1}`);
    break;
  }
}

// Show lines between main component and Field function
if (mainComponentStart >= 0 && fieldFunctionStart >= 0) {
  console.log('\n=== Lines from main component to Field function ===');
  for (let i = Math.max(0, fieldFunctionStart - 20); i < fieldFunctionStart + 5; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
