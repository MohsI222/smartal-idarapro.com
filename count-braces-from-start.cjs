const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/hr/HrEnterpriseSuite.tsx');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

let braceCount = 0;
let parenCount = 0;
let bracketCount = 0;

console.log('Counting braces from start of file...\n');

for (let i = 0; i < lines.length; i++) {
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
  
  // Log important lines
  if (line.includes('function') || line.includes('export')) {
    console.log(`Line ${lineNum}: ${line.trim().substring(0, 80)}`);
    console.log(`  Counts: Braces=${braceCount}, Parens=${parenCount}, Brackets=${bracketCount}\n`);
  }
}

console.log(`\nFinal counts at end of file:`);
console.log(`Braces: ${braceCount}`);
console.log(`Parens: ${parenCount}`);
console.log(`Brackets: ${bracketCount}`);

if (braceCount === 0 && parenCount === 0 && bracketCount === 0) {
  console.log('\n✓ All brackets balanced!');
} else {
  console.log('\n❌ Unbalanced brackets found!');
}
