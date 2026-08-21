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
    if (openBraces > 40) {
      console.log(`Line ${lineNum}: Open brace ${openBraces}`);
      console.log(`  ${lines[lineNum - 1].trim()}`);
    }
  }
  if (char === '}') {
    openBraces--;
    if (openBraces > 35 && openBraces < 45) {
      console.log(`Line ${lineNum}: Close brace ${openBraces}`);
      console.log(`  ${lines[lineNum - 1].trim()}`);
    }
  }
}

console.log(`\nFinal brace count: ${openBraces}`);
