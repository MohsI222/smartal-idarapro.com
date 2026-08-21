const fs = require('fs');

const content = fs.readFileSync('/Users/macbookair/smart-al-idara-pro/src/components/hr/HrEnterpriseSuite.tsx', 'utf8');

let openBraces = 0;
let lineNum = 1;
let inString = false;
let inTemplate = false;
let escapeNext = false;
const lines = content.split('\n');

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
    if (openBraces > 50) {
      console.log(`Line ${lineNum}: Open brace count = ${openBraces}`);
      console.log(`Context: ${content.substring(Math.max(0, i - 100), i + 100)}`);
    }
  }
  if (char === '}') {
    openBraces--;
    if (openBraces < 0) {
      console.log(`Line ${lineNum}: Negative brace count = ${openBraces}`);
      console.log(`Context: ${content.substring(Math.max(0, i - 100), i + 100)}`);
    }
  }
}

console.log(`\nFinal brace count: ${openBraces}`);
console.log(`Total lines: ${lines.length}`);

// Show the last 50 lines
console.log('\n=== Last 50 lines ===');
for (let i = Math.max(0, lines.length - 50); i < lines.length; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
