const fs = require('fs');
let content = fs.readFileSync('src/screens/AuthScreen.tsx', 'utf8');

const regex = /\{\/\* Assigned Class Standard, Stream & Section \*\/\}(.|\n)*?\{\/\* Password \*\/\}/g;

const newBlock = `              {/* Assigned Class Standard, Stream & Section */}
              <div className="p-3.5 rounded-2xl bg-[#0F1115] border border-[#2D3139] space-y-3">
                <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block">
                  Assigned Class Details
                </span>
                
                <div className="flex items-center gap-2 mb-2">
                  <input 
                    type="checkbox" 
                    id="signup-isClassTeacher"
                    checked={signupIsClassTeacher}
                    onChange={e => setSignupIsClassTeacher(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-[#1A1C23] border-[#2D3139]"
                  />
                  <label htmlFor="signup-isClassTeacher" className="text-[11px] font-bold text-slate-300 cursor-pointer">
                    I am a Class Teacher
                  </label>
                </div>

                {signupIsClassTeacher && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Standard</label>
                    <select
                      value={signupStandard}
                      onChange={e => setSignupStandard(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-[#1A1C23] border border-[#2D3139] text-xs font-semibold text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="Class 12 (Plus Two)">Class 12 (Plus Two)</option>
                      <option value="Class 11 (Plus One)">Class 11 (Plus One)</option>
                      <option value="Class 10">Class 10</option>
                      <option value="Class 9">Class 9</option>
                      <option value="Other">Other - Enter Manually</option>
                    </select>
                    {signupStandard === 'Other' && (
                      <input
                        type="text"
                        value={customStandard}
                        onChange={e => setCustomStandard(e.target.value)}
                        placeholder="e.g. Class 8"
                        className="w-full mt-2 px-2.5 py-1.5 rounded-xl bg-[#1A1C23] border border-[#2D3139] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Stream</label>
                    <select
                      value={signupStream}
                      onChange={e => setSignupStream(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-[#1A1C23] border border-[#2D3139] text-xs font-semibold text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="Bio-Science">Bio-Science</option>
                      <option value="Computer-Science">Computer-Science</option>
                      <option value="Commerce">Commerce</option>
                      <option value="Humanities">Humanities</option>
                      <option value="General">General</option>
                      <option value="Other">Other - Enter Manually</option>
                    </select>
                    {signupStream === 'Other' && (
                      <input
                        type="text"
                        value={customStream}
                        onChange={e => setCustomStream(e.target.value)}
                        placeholder="e.g. Vocational"
                        className="w-full mt-2 px-2.5 py-1.5 rounded-xl bg-[#1A1C23] border border-[#2D3139] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Section</label>
                    <input
                      type="text"
                      value={signupSection}
                      onChange={e => setSignupSection(e.target.value.toUpperCase())}
                      placeholder="A"
                      className="w-full px-2.5 py-2 rounded-xl bg-[#1A1C23] border border-[#2D3139] text-xs font-bold text-white text-center focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
                )}
              </div>

              {/* Password */}`;

content = content.replace(regex, newBlock);
fs.writeFileSync('src/screens/AuthScreen.tsx', content);
