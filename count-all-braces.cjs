const fs = require('fs');

const content = fs.readFileSync('/Users/macbookair/smart-al-idara-pro/src/components/hr/HrEnterpriseSuite.tsx', 'utf8');

const lines = content.split('\n');

// Find the main component function
let startLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('export function HrEnterpriseSuite')) {
    startLine = i;
    break;
  }
}

// Count ALL braces from the start line (including the function signature)
let openBraces = 0;
let inString = false;
let inTemplate = false;
let escapeNext = false;

for (let i = startLine; i < lines.length; i++) {
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
      if (openBraces > 50) {
        console.log(`Line ${i + 1}: Open brace ${openBraces}`);
      }
    }
    if (char === '}') {
      openBraces--;
      
      // When we close back to -1, that's where the component ends (after the function signature brace)
      if (openBraces === -1) {
        console.log(`\nComponent should end at line ${i + 1}`);
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

console.log(`Never reached brace count -1. Final count: ${openBraces}`);
