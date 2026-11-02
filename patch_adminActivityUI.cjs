const fs = require('fs');
const content = fs.readFileSync('src/screens/SchoolAdminDashboardScreen.tsx', 'utf8');

const targetStr = `                  <button
                    type="button"
                    onClick={() => {
                      const jsonStr = JSON.stringify(realtimeActivities, null, 2);`;

const newStr = `                  <button
                    type="button"
                    onClick={handleClearTeacherActivity}
                    className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear Activity</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const jsonStr = JSON.stringify(realtimeActivities, null, 2);`;

const newContent = content.replace(targetStr, newStr);
fs.writeFileSync('src/screens/SchoolAdminDashboardScreen.tsx', newContent);
console.log('Patched handleClearTeacherActivity UI');
