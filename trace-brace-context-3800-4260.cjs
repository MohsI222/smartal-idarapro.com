const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/hr/HrEnterpriseSuite.tsx');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

let braceCount = 0;

console.log('Detailed trace from line 3800 to 4260:\n');

for (let i = 3799; i < Math.min(4260, lines.length); i++) {
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
    
    if (braceCount === 0) {
      console.log(`  ✓ Brace count reached 0`);
    }
    console.log();
  }
}

console.log(`\nFinal brace count: ${braceCount}`);
