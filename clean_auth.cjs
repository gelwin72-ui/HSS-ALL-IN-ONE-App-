const fs = require('fs');
let content = fs.readFileSync('src/screens/AuthScreen.tsx', 'utf8');

content = content.replace("                  </>\n                  )}\n                </div>\n              {/* Password */}", "              {/* Password */}");

fs.writeFileSync('src/screens/AuthScreen.tsx', content);
