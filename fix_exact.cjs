const fs = require('fs');
let content = fs.readFileSync('src/screens/AuthScreen.tsx', 'utf8');

content = content.replace('                      />\n                  </div>\n                  <div>\n                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Stream</label>', '                      />\n                    )}\n                  </div>\n                  <div>\n                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Stream</label>');

content = content.replace('                      />\n                  </div>\n                  <div>\n                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Section</label>', '                      />\n                    )}\n                  </div>\n                  <div>\n                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Section</label>');

fs.writeFileSync('src/screens/AuthScreen.tsx', content);
