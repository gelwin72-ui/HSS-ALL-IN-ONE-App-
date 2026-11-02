const fs = require('fs');
let lines = fs.readFileSync('src/screens/SchoolAdminDashboardScreen.tsx', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i] === '                      </div>' && lines[i+1] === '                        <div className="flex justify-between text-xs">') {
    lines[i] = '                      </div>\n                      <div className="space-y-1.5 pt-2 border-t border-[#2D3139]">';
  }
}

fs.writeFileSync('src/screens/SchoolAdminDashboardScreen.tsx', lines.join('\n'));
