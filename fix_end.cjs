const fs = require('fs');
let lines = fs.readFileSync('src/screens/AuthScreen.tsx', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i] === '            </form>' && lines[i+1] === '        </div>' && lines[i+2] === '' && lines[i+3] === '        {/* Security & Features Summary Badges */}') {
    lines.splice(i+1, 0, '          )}');
  }
}

fs.writeFileSync('src/screens/AuthScreen.tsx', lines.join('\n'));
