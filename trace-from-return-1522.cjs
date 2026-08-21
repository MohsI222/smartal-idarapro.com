const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/hr/HrEnterpriseSuite.tsx');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

let braceCount = 0;

console.log('Tracing braces from return statement (line 1522):\n');

for (let i = 1521; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  const beforeCount = braceCount;
  
  for (const char of line) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
  }
  
  if (braceCount !== beforeCount) {
    console.log(`Line ${lineNum}: ${line.trim().substring(0, 70)}`);
    console.log(`  Count: ${beforeCount} → ${braceCount}`);
    
    if (braceCount === 0 && i > 1521) {
      console.log(`  ✓ Brace count reached 0`);
    }
    console.log();
  }
  
  if (line.includes('export default')) {
    console.log(`\nReached export default at line ${lineNum}`);
    console.log(`Brace count: ${braceCount}`);
    break;
  }
}

console.log(`\nFinal brace count: ${braceCount}`);
