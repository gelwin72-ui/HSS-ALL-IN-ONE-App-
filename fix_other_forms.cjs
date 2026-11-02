const fs = require('fs');
let lines = fs.readFileSync('src/screens/AuthScreen.tsx', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i] === '          {/* 3. SCHOOL ADMIN LOGIN */}' && lines[i+1] === '          )}') {
    lines[i] = '          )}';
    lines[i+1] = '          {/* 3. SCHOOL ADMIN LOGIN */}';
  }
  if (lines[i] === '          {/* 4. PASSWORD RESET */}' && lines[i+1] === '          )}') {
    lines[i] = '          )}';
    lines[i+1] = '          {/* 4. PASSWORD RESET */}';
  }
}

fs.writeFileSync('src/screens/AuthScreen.tsx', lines.join('\n'));
