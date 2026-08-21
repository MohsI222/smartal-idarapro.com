const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/hr/HrEnterpriseSuite.tsx');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

// Start from the HrEnterpriseSuite function definition (line 186)
let braceCount = 0;
let startLine = 185; // 0-indexed for line 186

console.log('Tracing braces from HrEnterpriseSuite function start (line 186):\n');

for (let i = startLine; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  const beforeCount = braceCount;
  
  for (const char of line) {
   if (char === '{') braceCount++;
    if (char === '}') braceCount--;
  }
  
  // Stop at export default
  if (line.includes('export default')) {
    console.log(`\nReached 'export default' at line ${lineNum}`);
    console.log(`Brace count at this point: ${braceCount}`);
    break;
  }
  
  if (braceCount !== beforeCount) {
    console.log(`Line ${lineNum}: ${line.trim().substring(0, 70)}`);
    console.log(`  Count: ${beforeCount} → ${braceCount}`);
    
    if (braceCount === 0) {
      console.log(`  ✓ Brace count reached 0 here`);
    }
    console.log();
  }
}

console.log(`\nFinal brace count before export: ${braceCount}`);
