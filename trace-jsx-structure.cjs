const fs = require('fs');

const content = fs.readFileSync('/Users/macbookair/smart-al-idara-pro/src/components/hr/HrEnterpriseSuite.tsx', 'utf8');

const lines = content.split('\n');

// Find the main return statement
let mainReturnLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('return (') && i > 1500) {
    mainReturnLine = i;
    console.log(`Main return at line ${i + 1}`);
    break;
  }
}

// Count braces from the return statement
let openBraces = 0;
let inString = false;
let inTemplate = false;
let escapeNext = false;

for (let i = mainReturnLine; i < lines.length; i++) {
  const line = lines[i];
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    const prevChar = j > 0 ? line[j - 1] : '';
    
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
        console.log(`Line ${i + 1}: Open brace ${openBraces}`);
        console.log(`  ${line.trim()}`);
      }
    }
    if (char === '}') {
      openBraces--;
      
      // When we close back to 0, that's where the return statement ends
      if (openBraces === 0) {
        console.log(`\nReturn should end at line ${i + 1}`);
        console.log(`Line: ${line.trim()}`);
        
        // Show context around this line
        console.log('\n=== Context ===');
        for (let k = Math.max(0, i - 5); k < Math.min(lines.length, i + 5); k++) {
          console.log(`${k + 1}: ${lines[k]}`);
        }
        process.exit(0);
      }
    }
  }
}

console.log(`Never reached brace count 0. Final count: ${openBraces}`);
