const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/hr/HrEnterpriseSuite.tsx');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

let braceCount = 0;

console.log('Detailed brace trace for lines 60-110:\n');

for (let i = 59; i < Math.min(110, lines.length); i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  const beforeCount = braceCount;
  
  for (const char of line) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
  }
  
  if (line.includes('{') || line.includes('}')) {
    console.log(`Line ${lineNum}: ${line.trim()}`);
    console.log(`  Before: ${beforeCount}, After: ${braceCount}, Change: ${braceCount - beforeCount}`);
    console.log();
  }
}

console.log(`\nFinal brace count: ${braceCount}`);
