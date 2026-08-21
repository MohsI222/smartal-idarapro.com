const fs = require('fs');

const content = fs.readFileSync('/Users/macbookair/smart-al-idara-pro/src/components/hr/HrEnterpriseSuite.tsx', 'utf8');

let openBraces = 0;
let openParens = 0;
let openBrackets = 0;
let inString = false;
let inTemplate = false;
let escapeNext = false;

for (let i = 0; i < content.length; i++) {
  const char = content[i];
  const prevChar = i > 0 ? content[i - 1] : '';
  
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
  
  if (char === '{') openBraces++;
  if (char === '}') openBraces--;
  if (char === '(') openParens++;
  if (char === ')') openParens--;
  if (char === '[') openBrackets++;
  if (char === ']') openBrackets--;
  
  if (openBraces < 0 || openParens < 0 || openBrackets < 0) {
    console.log(`Negative count at position ${i}: char=${char}`);
    console.log(`Braces: ${openBraces}, Parens: ${openParens}, Brackets: ${openBrackets}`);
    console.log(`Context: ${content.substring(Math.max(0, i - 50), i + 50)}`);
  }
}

console.log(`Final counts:`);
console.log(`Braces: ${openBraces}`);
console.log(`Parens: ${openParens}`);
console.log(`Brackets: ${openBrackets}`);

if (openBraces !== 0 || openParens !== 0 || openBrackets !== 0) {
  console.log('\n❌ Unbalanced brackets found!');
  process.exit(1);
} else {
  console.log('\n✅ All brackets balanced');
}
