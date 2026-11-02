const fs = require('fs');
let lines = fs.readFileSync('src/screens/AuthScreen.tsx', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('value={') && !lines[i].includes('onChange') && !lines[i].includes('<select')) {
    const match = lines[i].match(/value=\{([a-zA-Z0-9_]+)\}/);
    if (match) {
      const varName = match[1];
      let setterName = 'set' + varName.charAt(0).toUpperCase() + varName.slice(1);
      
      // Some formatting:
      let indent = lines[i].match(/^\s*/)[0];
      
      // Inject the onChange after value=...
      let newLine = indent + `onChange={e => ${setterName}(e.target.value)}`;
      lines.splice(i+1, 0, newLine);
    }
  }
}

fs.writeFileSync('src/screens/AuthScreen.tsx', lines.join('\n'));
