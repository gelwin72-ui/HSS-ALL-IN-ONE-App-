const fs = require('fs');
let lines = fs.readFileSync('src/screens/AuthScreen.tsx', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('type="text"') && lines[i+1].includes('value={customStandard}')) {
    lines.splice(i+2, 0, '                        onChange={e => setCustomStandard(e.target.value)}');
  }
  if (lines[i].includes('type="text"') && lines[i+1].includes('value={customStream}')) {
    lines.splice(i+2, 0, '                        onChange={e => setCustomStream(e.target.value)}');
  }
}

fs.writeFileSync('src/screens/AuthScreen.tsx', lines.join('\n'));
