const fs = require('fs');
let lines = fs.readFileSync('src/screens/SchoolAdminDashboardScreen.tsx', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('                      <div className="space-y-1.5 pt-2 border-t border-[#2D3139]">') && lines[i-1] && lines[i-1].includes('              </div>')) {
    // Delete from i to i+24
    lines.splice(i, 25);
    break;
  }
}

fs.writeFileSync('src/screens/SchoolAdminDashboardScreen.tsx', lines.join('\n'));
