const fs = require('fs');

const content = fs.readFileSync('/Users/macbookair/smart-al-idara-pro/src/components/hr/HrEnterpriseSuite.tsx', 'utf8');

const lines = content.split('\n');

// Find the main component function
let mainComponentStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('export function HrEnterpriseSuite')) {
    mainComponentStart = i;
    break;
  }
}

// Count braces from the start of the component
let openBraces = 0;
let inString = false;
let inTemplate = false;
let escapeNext = false;

for (let i = mainComponentStart; i < lines.length; i++) {
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
    }
    if (char === '}') {
      openBraces--;
      
      // When we close back to 0, that's where the component ends
      if (openBraces === 0) {
        console.log(`Component should end at line ${i + 1}`);
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
