const fs = require('fs');
let lines = fs.readFileSync('src/screens/AuthScreen.tsx', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('value={customStandard}') && lines[i].includes('onChange')) {
    // wait I just added it.
  }
}

let content = lines.join('\n');
content = content.replace('                      />\n                  </div>\n                  <div>\n                    <label className="block text-[10px]', '                      />\n                    )}\n                  </div>\n                  <div>\n                    <label className="block text-[10px]');
content = content.replace('                      />\n                  </div>\n                  <div>\n                    <label className="block text-[10px]', '                      />\n                    )}\n                  </div>\n                  <div>\n                    <label className="block text-[10px]');

fs.writeFileSync('src/screens/AuthScreen.tsx', content);
