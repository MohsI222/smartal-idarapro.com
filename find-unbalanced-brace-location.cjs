const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/hr/HrEnterpriseSuite.tsx');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

let braceCount = 0;
let lastUnbalancedLine = -1;
let lastUnbalancedContent = '';

console.log('Tracing all braces to find imbalance...\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  const beforeCount = braceCount;
  
  for (const char of line) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
  }
  
  if (braceCount !== beforeCount) {
    if (braceCount < 0) {
      lastUnbalancedLine = lineNum;
      lastUnbalancedContent = line.trim();
      console.log(`⚠️  Line ${lineNum}: ${line.trim().substring(0, 80)}`);
      console.log(`   Brace count went negative: ${beforeCount} → ${braceCount}`);
      console.log();
    }
  }
}

console.log(`\nFinal brace count: ${braceCount}`);
if (braceCount !== 0) {
  console.log(`❌ Unbalanced! Missing ${braceCount} closing brace(s)`);
} else {
  console.log(`✓ All balanced`);
}
