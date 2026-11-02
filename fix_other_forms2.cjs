const fs = require('fs');
let lines = fs.readFileSync('src/screens/AuthScreen.tsx', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{/* 3. SCHOOL ADMIN') && lines[i+1] === '          )}') {
    let tmp = lines[i];
    lines[i] = '          )}';
    lines[i+1] = tmp;
  }
  if (lines[i].includes('{/* 4. PASSWORD RESET') && lines[i+1] === '          )}') {
    let tmp = lines[i];
    lines[i] = '          )}';
    lines[i+1] = tmp;
  }
}

fs.writeFileSync('src/screens/AuthScreen.tsx', lines.join('\n'));
