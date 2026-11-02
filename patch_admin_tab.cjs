const fs = require('fs');
let content = fs.readFileSync('src/screens/SchoolAdminDashboardScreen.tsx', 'utf8');

const targetTabStr = `type AdminTab = 'teachers-info' | 'students-classes' | 'timetables' | 'teachers' | 'academics' | 'broadcasts' | 'settings-data' | 'audit-logs' | 'reports-center' | 'teacher-activity';`;
const newTabStr = `type AdminTab = 'teachers-info' | 'students-classes' | 'timetables' | 'teachers' | 'academics' | 'broadcasts' | 'settings-data' | 'audit-logs' | 'reports-center' | 'teacher-activity' | 'teacher-signups';`;
content = content.replace(targetTabStr, newTabStr);

const targetSidebarUI = `          <nav className="space-y-1.5 px-3">
            <h3 className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 mt-4">Core Directory</h3>
            <button
              id="tab-admin-teachers-info"`;

const newSidebarUI = `          <nav className="space-y-1.5 px-3">
            <h3 className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 mt-4">Core Directory</h3>
            <button
              id="tab-admin-teacher-signups"
              onClick={() => setActiveTab('teacher-signups')}
              className={\`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all \${
                activeTab === 'teacher-signups'
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20 shadow-sm'
                  : 'text-slate-400 hover:bg-[#252830] hover:text-slate-200 border border-transparent'
              }\`}
            >
              <div className="flex items-center gap-2.5">
                <UserPlus className="w-4 h-4 text-amber-500" />
                <span>Teacher Signups</span>
              </div>
            </button>
            <button
              id="tab-admin-teachers-info"`;
content = content.replace(targetSidebarUI, newSidebarUI);

fs.writeFileSync('src/screens/SchoolAdminDashboardScreen.tsx', content);
console.log('Patched Admin Tab UI');
