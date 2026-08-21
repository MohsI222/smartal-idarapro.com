const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/hr/HrEnterpriseSuite.tsx');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

// Find the main return statement (after loading check)
let returnLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('return (') && i > 1520) {
    returnLine = i + 1; // 1-indexed
    break;
  }
}

console.log(`Main return statement found at line: ${returnLine}`);

if (returnLine === -1) {
  console.log('Return statement not found!');
  process.exit(1);
}

// Track braces from the return line
let braceCount = 0;
let parenCount = 0;
let bracketCount = 0;

for (let i = returnLine - 1; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  for (const char of line) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
    if (char === '(') parenCount++;
    if (char === ')') parenCount--;
    if (char === '[') bracketCount++;
    if (char === ']') bracketCount--;
  }
  
  // Log when counts change significantly
  if (braceCount === 0 && parenCount === 0 && bracketCount === 0 && i > returnLine) {
    console.log(`\n✓ All brackets balanced at line ${lineNum}`);
    console.log(`Braces: ${braceCount}, Parens: ${parenCount}, Brackets: ${bracketCount}`);
    console.log(`Line content: ${line.trim().substring(0, 80)}`);
    break;
  }
  
  if (i === lines.length - 1) {
    console.log(`\n❌ End of file reached without balance`);
    console.log(`Final counts - Braces: ${braceCount}, Parens: ${parenCount}, Brackets: ${bracketCount}`);
  }
}

// Show context around where brace count should be 0
console.log('\n--- Last 20 lines ---');
for (let i = Math.max(0, lines.length - 20); i < lines.length; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
