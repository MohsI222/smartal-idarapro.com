const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/hr/HrEnterpriseSuite.tsx');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

let braceCount = 0;
let parenCount = 0;

console.log('Detailed trace from line 1520 to end:\n');

for (let i = 1519; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  const beforeBrace = braceCount;
  const beforeParen = parenCount;
  
  for (const char of line) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
    if (char === '(') parenCount++;
    if (char === ')') parenCount--;
  }
  
  if (braceCount !== beforeBrace || parenCount !== beforeParen) {
    console.log(`Line ${lineNum}: ${line.trim().substring(0, 70)}`);
    console.log(`  Braces: ${beforeBrace} → ${braceCount}, Parens: ${beforeParen} → ${parenCount}`);
    
    if (braceCount === 0 && parenCount === 0 && i > 1520) {
      console.log(`  ✓✓✓ BALANCED HERE ✓✓✓`);
    }
    console.log();
  }
}

console.log(`\nFinal counts - Braces: ${braceCount}, Parens: ${parenCount}`);
