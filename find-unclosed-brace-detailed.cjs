const fs = require('fs');

const content = fs.readFileSync('/Users/macbookair/smart-al-idara-pro/src/components/hr/HrEnterpriseSuite.tsx', 'utf8');

let openBraces = 0;
let lineNum = 1;
let inString = false;
let inTemplate = false;
let escapeNext = false;
const lines = content.split('\n');
const bracePositions = [];

for (let i = 0; i < content.length; i++) {
  const char = content[i];
  const prevChar = i > 0 ? content[i - 1] : '';
  
  if (char === '\n') lineNum++;
  
  if (escapeNext) {
    escapeNext = false;
    continue;
  }
  
  if (char === '\\') {
    escapeNext = true;
    continue;
  }
  
  if (inString) {
    if (char === inString) {
      inString = false;
    }
    continue;
  }
  
  if (inTemplate) {
    if (char === '`' && prevChar !== '$') {
      inTemplate = false;
    }
    continue;
  }
  
  if (char === '"' || char === "'" || char === '`') {
    if (char === '`') {
      inTemplate = true;
    } else {
      inString = char;
    }
    continue;
  }
  
  if (char === '{') {
    openBraces++;
    bracePositions.push({ line: lineNum, type: 'open', count: openBraces });
  }
  if (char === '}') {
    openBraces--;
    bracePositions.push({ line: lineNum, type: 'close', count: openBraces });
  }
}

console.log(`Final brace count: ${openBraces}`);

if (openBraces > 0) {
  console.log('\n=== Last 10 open braces (unclosed) ===');
  const unclosed = bracePositions.filter(b => b.type === 'open').slice(-10);
  unclosed.forEach(b => {
    console.log(`Line ${b.line}: count = ${b.count}`);
    console.log(`  ${lines[b.line - 1].trim()}`);
  });
  
  console.log('\n=== Last 10 close braces ===');
  const closed = bracePositions.filter(b => b.type === 'close').slice(-10);
  closed.forEach(b => {
    console.log(`Line ${b.line}: count = ${b.count}`);
    console.log(`  ${lines[b.line - 1].trim()}`);
  });
}
