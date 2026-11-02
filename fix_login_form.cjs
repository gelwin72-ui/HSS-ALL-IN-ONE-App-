const fs = require('fs');
let lines = fs.readFileSync('src/screens/AuthScreen.tsx', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i] === '          {/* 2. TEACHER LOGIN FORM */}' && lines[i+1] === '          )}') {
    lines[i] = '          )}';
    lines[i+1] = '          {/* 2. TEACHER LOGIN FORM */}';
  }
}

fs.writeFileSync('src/screens/AuthScreen.tsx', lines.join('\n'));
