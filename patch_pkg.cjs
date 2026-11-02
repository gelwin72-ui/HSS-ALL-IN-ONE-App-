const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts.dev = 'tsx server.ts';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
