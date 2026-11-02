const fs = require('fs');
let lines = fs.readFileSync('src/screens/SchoolAdminDashboardScreen.tsx', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i] === '                  ))' && lines[i+1] === '                )}') {
    lines[i+1] = '                })()}';
  }
}

fs.writeFileSync('src/screens/SchoolAdminDashboardScreen.tsx', lines.join('\n'));
