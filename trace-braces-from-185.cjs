const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/hr/HrEnterpriseSuite.tsx');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

let braceCount = 0;

console.log('Tracing braces from line 185 onwards...\n');

for (let i = 184; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  const beforeCount = braceCount;
  
  for (const char of line) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
  }
  
  if (braceCount !== beforeCount) {
    console.log(`Line ${lineNum}: ${line.trim().substring(0, 80)}`);
    console.log(`  Count: ${beforeCount} → ${braceCount}`);
    console.log();
  }
  
  if (braceCount > 5) {
    console.log(`⚠️  Brace count reached ${braceCount} at line ${lineNum}`);
    console.log(`   Line: ${line.trim().substring(0, 80)}`);
    console.log();
  }
}

console.log(`\nFinal brace count: ${braceCount}`);
