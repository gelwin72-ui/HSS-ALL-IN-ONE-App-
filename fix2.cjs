const fs = require('fs');
let lines = fs.readFileSync('src/screens/AuthScreen.tsx', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i] === '        {/* Feedback Alerts */}') {
    lines.splice(i, 0, '        )}');
    i++;
  }
  if (lines[i] === '        {successMsg && (') {
    lines.splice(i, 0, '        )}');
    i++;
  }
  if (lines[i] === '        {/* Main Form Card */}') {
    lines.splice(i, 0, '        )}');
    i++;
  }
  if (lines[i] === '          {mode === \'login\' && (') {
    lines.splice(i, 0, '          )}');
    i++;
  }
  if (lines[i] === '          {mode === \'admin\' && (') {
    lines.splice(i, 0, '          )}');
    i++;
  }
  if (lines[i] === '          {mode === \'reset\' && (') {
    lines.splice(i, 0, '          )}');
    i++;
  }
  if (lines[i] === '        </div>' && lines[i+1] === '' && lines[i+2] === '        {/* Global Footer */}') {
    lines.splice(i, 0, '          )}');
    i++;
  }
}

fs.writeFileSync('src/screens/AuthScreen.tsx', lines.join('\n'));
