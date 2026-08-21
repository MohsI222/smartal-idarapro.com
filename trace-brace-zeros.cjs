const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/hr/HrEnterpriseSuite.tsx');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

let braceCount = 0;
let zeroCrossings = [];

console.log('Finding where brace count returns to zero...\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  for (const char of line) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
  }
  
  if (braceCount === 0) {
    zeroCrossings.push({ line: lineNum, content: line.trim().substring(0, 60) });
  }
}

console.log(`Lines where brace count returns to zero (${zeroCrossings.length} total):\n`);
zeroCrossings.slice(-5).forEach(z => {
  console.log(`Line ${z.line}: ${z.content}`);
});

console.log(`\nFinal brace count: ${braceCount}`);
