const fs = require('fs');
let content = fs.readFileSync('src/screens/AuthScreen.tsx', 'utf8');

const targetUI = `                {/* Class Assignment */}
                <div className="bg-[#0F1115] p-3 rounded-2xl border border-[#2D3139] space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[11px] font-bold text-slate-300">Class Assigned (Optional initially)</span>
                  </div>`;

const newUI = `                {/* Class Assignment */}
                <div className="bg-[#0F1115] p-3 rounded-2xl border border-[#2D3139] space-y-3">
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
                    <>
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[11px] font-bold text-slate-300">Class Assigned (Optional initially)</span>
                  </div>`;

content = content.replace(targetUI, newUI);

const targetUIEnd = `                  </div>
                </div>`;

// Wait, we need to close the conditional rendering we added: `</>`
const targetSection = `                    <input
                      type="text"
                      value={signupSection}
                      onChange={e => setSignupSection(e.target.value.toUpperCase())}
                      placeholder="A"
                      className="w-full px-2.5 py-2 rounded-xl bg-[#1A1C23] border border-[#2D3139] text-xs font-bold text-white text-center focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>`;

const newSection = `                    <input
                      type="text"
                      value={signupSection}
                      onChange={e => setSignupSection(e.target.value.toUpperCase())}
                      placeholder="A"
                      className="w-full px-2.5 py-2 rounded-xl bg-[#1A1C23] border border-[#2D3139] text-xs font-bold text-white text-center focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  </>
                  )}
                </div>`;

content = content.replace(targetSection, newSection);
fs.writeFileSync('src/screens/AuthScreen.tsx', content);
console.log('Patched AuthScreen UI');
