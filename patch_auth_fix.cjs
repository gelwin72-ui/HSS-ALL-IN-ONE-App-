const fs = require('fs');
let content = fs.readFileSync('src/screens/AuthScreen.tsx', 'utf8');

const targetError = `                  </>
                  )}
                </div>
              </div>

              {/* Password */}`;

const newFix = `                  </>
                  )}
                </div>

              {/* Password */}`;

content = content.replace(targetError, newFix);
fs.writeFileSync('src/screens/AuthScreen.tsx', content);
console.log('Patched Auth fix');
