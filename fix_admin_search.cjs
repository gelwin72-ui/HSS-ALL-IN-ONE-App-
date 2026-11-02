const fs = require('fs');
let content = fs.readFileSync('src/screens/SchoolAdminDashboardScreen.tsx', 'utf8');

const targetStr = `              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              </div>`;

const newStr = `              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={signupSearch}
                    onChange={e => setSignupSearch(e.target.value)}
                    placeholder="Search by name, email, subject, phone..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
                <select
                  value={signupFilter}
                  onChange={e => setSignupFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm font-semibold text-slate-300 focus:outline-none focus:border-amber-500 transition sm:w-48"
                >
                  <option value="all">All Teachers</option>
                  <option value="class-teachers">Class Teachers Only</option>
                  <option value="subject-teachers">Subject Teachers Only</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(() => {
                  const filtered = teacherSignups.filter(t => {
                    const matchesSearch = !signupSearch ? true : 
                      (t.fullName?.toLowerCase().includes(signupSearch.toLowerCase()) || 
                       t.email?.toLowerCase().includes(signupSearch.toLowerCase()) || 
                       t.subject?.toLowerCase().includes(signupSearch.toLowerCase()) || 
                       t.mobileNumber?.includes(signupSearch));
                       
                    const matchesFilter = signupFilter === 'all' ? true :
                      signupFilter === 'class-teachers' ? t.isClassTeacher :
                      signupFilter === 'subject-teachers' ? !t.isClassTeacher : true;
                      
                    return matchesSearch && matchesFilter;
                  });
                  if (filtered.length === 0) {
                    return (
                      <div className="col-span-full py-12 text-center bg-[#0F1115] rounded-2xl border border-[#2D3139]">
                        <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-400" />
                        <p className="font-semibold text-slate-400">No registered teachers match your search.</p>
                      </div>
                    );
                  }
                  return filtered.map((t, idx) => (
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
                  ));
                })()}
              </div>`;

if(content.includes(targetStr)) {
  content = content.replace(targetStr, newStr);
  fs.writeFileSync('src/screens/SchoolAdminDashboardScreen.tsx', content);
  console.log('Successfully patched search');
} else {
  console.log('Could not find target string');
}
