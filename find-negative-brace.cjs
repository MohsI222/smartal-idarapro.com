const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/hr/HrEnterpriseSuite.tsx');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

let braceCount = 0;

console.log('Finding where brace count goes negative:\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  const beforeCount = braceCount;
  
  for (const char of line) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
  }
  
  if (braceCount < 0 && beforeCount >= 0) {
    console.log(`⚠️  FIRST NEGATIVE at line ${lineNum}: ${line.trim()}`);
    console.log(`   Brace count: ${beforeCount} → ${braceCount}`);
    console.log();
    break;
  }
}

console.log(`Final brace count: ${braceCount}`);
