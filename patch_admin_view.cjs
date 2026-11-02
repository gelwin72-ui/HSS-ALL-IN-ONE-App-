const fs = require('fs');
let content = fs.readFileSync('src/screens/SchoolAdminDashboardScreen.tsx', 'utf8');

const targetView = `        {/* TAB: RECENT TEACHER ACTIVITY */}
        {activeTab === 'teacher-activity' && (`;

const newView = `        {/* TAB: TEACHER SIGNUPS */}
        {activeTab === 'teacher-signups' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-[#1A1C23] p-5 sm:p-6 rounded-3xl border border-[#2D3139] space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2D3139] pb-4">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-amber-400" />
                    <span>Registered Teacher Profiles</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live directory of teachers authenticated via Firebase who have registered under <strong className="text-amber-400 font-mono">{activeSchoolCode}</strong>.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teacherSignups.length === 0 ? (
                  <div className="col-span-full py-12 text-center bg-[#0F1115] rounded-2xl border border-[#2D3139]">
                    <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-400" />
                    <p className="font-semibold text-slate-400">No registered teachers found.</p>
                  </div>
                ) : (
                  teacherSignups.map((t, idx) => (
                    <div key={idx} className="bg-[#0F1115] p-4 rounded-2xl border border-[#2D3139] shadow-sm flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-white text-sm">{t.fullName}</h4>
                          <div className="text-xs text-slate-400">{t.email}</div>
                        </div>
                        {t.isClassTeacher && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Class Teacher
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-[#2D3139]">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Phone:</span>
                          <span className="font-mono text-slate-300">{t.mobileNumber}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Subject:</span>
                          <span className="text-slate-300 font-medium">{t.subject}</span>
                        </div>
                        {t.isClassTeacher && (
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Class Assigned:</span>
                            <span className="text-slate-300 font-medium">{t.className} {t.stream} {t.section}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-[10px] pt-1">
                          <span className="text-slate-500">Registered:</span>
                          <span className="text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: RECENT TEACHER ACTIVITY */}
        {activeTab === 'teacher-activity' && (`;

content = content.replace(targetView, newView);
fs.writeFileSync('src/screens/SchoolAdminDashboardScreen.tsx', content);
console.log('Patched Admin View UI');
