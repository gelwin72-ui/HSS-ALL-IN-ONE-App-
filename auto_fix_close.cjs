const fs = require('fs');
let lines = fs.readFileSync('src/screens/AuthScreen.tsx', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('/>') && lines[i+1] && lines[i+1].includes('</div>') && lines[i-1].includes('border-[#2D3139]')) {
    // probably customStandard or customStream
    if (lines[i-6] && lines[i-6].includes('Other')) {
       lines.splice(i+1, 0, '                    )}');
    }
  }
}

fs.writeFileSync('src/screens/AuthScreen.tsx', lines.join('\n'));
