import React, { useState, useRef } from 'react';
import {
  School,
  User,
  BookOpen,
  Save,
  RotateCcw,
  CheckCircle2,
  Phone,
  Mail,
  Building,
  MapPin,
  Award,
  Camera,
  Calendar,
  Upload,
  Trash2,
  Sparkles
} from 'lucide-react';
import { SchoolProfile, ClassInfo, TeacherInfo } from '../types';

interface SchoolProfileScreenProps {
  school: SchoolProfile;
  classInfo: ClassInfo;
  teacher: TeacherInfo;
  studentCount: number;
  onSaveProfile: (school: SchoolProfile, classInfo: ClassInfo, teacher: TeacherInfo) => void;
  onResetDefaults: () => void;
}

export const SchoolProfileScreen: React.FC<SchoolProfileScreenProps> = ({
  school,
  classInfo,
  teacher,
  studentCount,
  onSaveProfile,
  onResetDefaults
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formDataSchool, setFormDataSchool] = useState<SchoolProfile>({ ...school });
  const [formDataClass, setFormDataClass] = useState<ClassInfo>({ ...classInfo });
  const [formDataTeacher, setFormDataTeacher] = useState<TeacherInfo>({ ...teacher });
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile(formDataSchool, formDataClass, formDataTeacher);
    setIsEditing(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all profile details to standard defaults?')) {
      onResetDefaults();
      setIsEditing(false);
    }
  };

  // Quick helper to update standard/stream and auto-update Class Name
  const handleStandardOrStreamChange = (field: 'standard' | 'stream' | 'section', value: string) => {
    const updated = { ...formDataClass, [field]: value };
    const autoClassName = `${updated.standard} ${updated.stream} ${updated.section}`.trim();
    updated.className = autoClassName;
    setFormDataClass(updated);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 animate-fade-in">
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-1">
            <School className="w-3.5 h-3.5" /> Institutional Setup
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            SCHOOL & CLASS PROFILE
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Configure school identification, class standard, stream, and class teacher details.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-purple-900/30 transition active:scale-95 flex items-center gap-1.5"
            >
              <Building className="w-4 h-4" />
              <span>EDIT PROFILE</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setFormDataSchool({ ...school });
                setFormDataClass({ ...classInfo });
                setFormDataTeacher({ ...teacher });
                setIsEditing(false);
              }}
              className="px-4 py-2 rounded-xl bg-[#252830] hover:bg-slate-700 text-slate-300 text-xs sm:text-sm transition"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2.5 rounded-xl bg-[#1A1C23] border border-[#2D3139] hover:bg-[#252830] text-slate-400 hover:text-rose-400 text-xs sm:text-sm transition"
            title="Reset to default details"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isSaved && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 flex items-center gap-3 text-sm animate-fade-in shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>Profile information saved successfully and updated permanently across all reports!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. School Information Card */}
        <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-[#2D3139]">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <School className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">School Information</h2>
              <p className="text-xs text-slate-400">Institutional branding used in official PDF reports</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">School Name *</label>
              <input
                type="text"
                required
                disabled={!isEditing}
                value={formDataSchool.schoolName}
                onChange={e => setFormDataSchool({ ...formDataSchool, schoolName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] disabled:bg-[#0F1115]/50 disabled:border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500 transition"
                placeholder="e.g. St. Sebastian's Higher Secondary School"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">School Address</label>
              <input
                type="text"
                disabled={!isEditing}
                value={formDataSchool.schoolAddress}
                onChange={e => setFormDataSchool({ ...formDataSchool, schoolAddress: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] disabled:bg-[#0F1115]/50 disabled:border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500 transition"
                placeholder="e.g. Civil Station Road, Ernakulam, Kerala - 682030"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">School Code</label>
              <input
                type="text"
                disabled={!isEditing}
                value={formDataSchool.schoolCode}
                onChange={e => setFormDataSchool({ ...formDataSchool, schoolCode: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] disabled:bg-[#0F1115]/50 disabled:border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500 transition"
                placeholder="Enter your school code"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">School Phone Number</label>
              <input
                type="tel"
                disabled={!isEditing}
                value={formDataSchool.schoolPhone}
                onChange={e => setFormDataSchool({ ...formDataSchool, schoolPhone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] disabled:bg-[#0F1115]/50 disabled:border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500 transition"
                placeholder="e.g. +91 484 2345678"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">School Email</label>
              <input
                type="email"
                disabled={!isEditing}
                value={formDataSchool.schoolEmail}
                onChange={e => setFormDataSchool({ ...formDataSchool, schoolEmail: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] disabled:bg-[#0F1115]/50 disabled:border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500 transition"
                placeholder="e.g. school@kerala.gov.in"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Principal Name</label>
              <input
                type="text"
                disabled={!isEditing}
                value={formDataSchool.principalName}
                onChange={e => setFormDataSchool({ ...formDataSchool, principalName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] disabled:bg-[#0F1115]/50 disabled:border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500 transition"
                placeholder="e.g. Principal"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Principal Phone Number</label>
              <input
                type="tel"
                disabled={!isEditing}
                value={formDataSchool.principalPhone}
                onChange={e => setFormDataSchool({ ...formDataSchool, principalPhone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] disabled:bg-[#0F1115]/50 disabled:border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500 transition"
                placeholder="e.g. +91 94471 23456"
              />
            </div>
          </div>
        </div>

        {/* 2. Class Information Card */}
        <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-[#2D3139]">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Class Information</h2>
              <p className="text-xs text-slate-400">Class, Stream, Section and Academic Session</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Class / Standard *</label>
              {isEditing ? (
                <select
                  value={formDataClass.standard}
                  onChange={e => handleStandardOrStreamChange('standard', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="Class 12 (Plus Two)">Class 12 (Plus Two)</option>
                  <option value="Class 11 (Plus One)">Class 11 (Plus One)</option>
                  <option value="Class 12">Class 12</option>
                  <option value="Class 11">Class 11</option>
                  <option value="Class 10">Class 10</option>
                </select>
              ) : (
                <input
                  type="text"
                  disabled
                  value={formDataClass.standard}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115]/50 border border-[#2D3139] text-sm text-white"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Stream *</label>
              {isEditing ? (
                <select
                  value={formDataClass.stream}
                  onChange={e => handleStandardOrStreamChange('stream', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="Science (Bio-Maths)">Science (Bio-Maths)</option>
                  <option value="Science (Computer Science)">Science (Computer Science)</option>
                  <option value="Commerce">Commerce</option>
                  <option value="Humanities">Humanities</option>
                  <option value="Vocational Higher Secondary">Vocational Higher Secondary</option>
                  <option value="General">General</option>
                </select>
              ) : (
                <input
                  type="text"
                  disabled
                  value={formDataClass.stream}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115]/50 border border-[#2D3139] text-sm text-white"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Section *</label>
              <input
                type="text"
                disabled={!isEditing}
                value={formDataClass.section}
                onChange={e => handleStandardOrStreamChange('section', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] disabled:bg-[#0F1115]/50 disabled:border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500 transition"
                placeholder="e.g. A"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Class Name (Header Display) *
              </label>
              <input
                type="text"
                required
                disabled={!isEditing}
                value={formDataClass.className}
                onChange={e => setFormDataClass({ ...formDataClass, className: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] disabled:bg-[#0F1115]/50 disabled:border-[#2D3139] text-sm font-semibold text-purple-300 focus:outline-none focus:border-purple-500 transition"
                placeholder="e.g. Class 11 Science A"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Academic Year *</label>
              <input
                type="text"
                required
                disabled={!isEditing}
                value={formDataClass.academicYear}
                onChange={e => setFormDataClass({ ...formDataClass, academicYear: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] disabled:bg-[#0F1115]/50 disabled:border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500 transition"
                placeholder="e.g. 2025-2026"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Total Class Strength</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  disabled={!isEditing}
                  value={formDataClass.classStrength || studentCount}
                  onChange={e => setFormDataClass({ ...formDataClass, classStrength: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] disabled:bg-[#0F1115]/50 disabled:border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500 transition font-mono"
                />
                <span className="text-xs text-slate-400 whitespace-nowrap">({studentCount} Registered)</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Class Teacher Information Card */}
        <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#2D3139]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Class Teacher Information & Profile Photo</h2>
                <p className="text-xs text-slate-400">Educator details and photo synced with School Admin Portal</p>
              </div>
            </div>
            {formDataTeacher.photoUrl && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles className="w-3.5 h-3.5" /> Photo Attached
              </span>
            )}
          </div>

          {/* Teacher Profile Photo Section */}
          <div className="p-4 rounded-2xl bg-[#0F1115] border border-[#2D3139] flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            {/* Avatar / Photo Container */}
            <div className="relative group shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-[#1A1C23] border-2 border-purple-500/40 overflow-hidden shadow-xl flex items-center justify-center relative">
                {formDataTeacher.photoUrl ? (
                  <img
                    src={formDataTeacher.photoUrl}
                    alt={formDataTeacher.teacherName || 'Teacher'}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-4xl sm:text-5xl select-none">
                    {formDataTeacher.avatar || '👨‍🏫'}
                  </span>
                )}
              </div>

              {isEditing && (
                <label className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-lg cursor-pointer transition active:scale-95 border border-white/20" title="Upload Photo">
                  <Camera className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const base64 = event.target?.result as string;
                          if (base64) {
                            setFormDataTeacher(prev => ({ ...prev, photoUrl: base64 }));
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              )}
            </div>

            {/* Photo & Avatar Controls */}
            <div className="space-y-2.5 flex-1 text-center sm:text-left">
              <div>
                <h4 className="text-sm font-bold text-white">Teacher Profile Photo</h4>
                <p className="text-xs text-slate-400">
                  Upload an official portrait or choose an avatar emoji. Visible to School Admin in the Institutional Portal.
                </p>
              </div>

              {isEditing ? (
                <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start pt-1">
                  <label className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold cursor-pointer transition flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Image File</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const base64 = event.target?.result as string;
                            if (base64) {
                              setFormDataTeacher(prev => ({ ...prev, photoUrl: base64 }));
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>

                  {formDataTeacher.photoUrl && (
                    <button
                      type="button"
                      onClick={() => setFormDataTeacher(prev => ({ ...prev, photoUrl: undefined }))}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Photo</span>
                    </button>
                  )}

                  {/* Avatar Emoji Quick Pickers */}
                  <div className="flex items-center gap-1.5 pl-2 border-l border-[#2D3139]">
                    <span className="text-[11px] text-slate-400">Or Avatar:</span>
                    {['👨‍🏫', '👩‍🏫', '👨‍🔬', '👩‍🔬', '👨‍💼', '👩‍💼'].map(emo => (
                      <button
                        key={emo}
                        type="button"
                        onClick={() => setFormDataTeacher(prev => ({ ...prev, avatar: emo, photoUrl: undefined }))}
                        className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition ${
                          formDataTeacher.avatar === emo && !formDataTeacher.photoUrl
                            ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                            : 'bg-[#1A1C23] hover:bg-[#252830] text-slate-300'
                        }`}
                      >
                        {emo}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic">
                  {formDataTeacher.photoUrl ? 'Custom photo uploaded & active' : `Avatar: ${formDataTeacher.avatar || '👨‍🏫'}`}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Teacher Name *</label>
              <input
                type="text"
                required
                disabled={!isEditing}
                value={formDataTeacher.teacherName}
                onChange={e => setFormDataTeacher({ ...formDataTeacher, teacherName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] disabled:bg-[#0F1115]/50 disabled:border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500 transition"
                placeholder="Teacher Name"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Designation</label>
              <input
                type="text"
                disabled={!isEditing}
                value={formDataTeacher.designation}
                onChange={e => setFormDataTeacher({ ...formDataTeacher, designation: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] disabled:bg-[#0F1115]/50 disabled:border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500 transition"
                placeholder="e.g. HSST Physics / Class Teacher"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Phone Number</label>
              <input
                type="tel"
                disabled={!isEditing}
                value={formDataTeacher.phone}
                onChange={e => setFormDataTeacher({ ...formDataTeacher, phone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] disabled:bg-[#0F1115]/50 disabled:border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500 transition"
                placeholder="e.g. +91 98470 54321"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
              <input
                type="email"
                disabled={!isEditing}
                value={formDataTeacher.email}
                onChange={e => setFormDataTeacher({ ...formDataTeacher, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] disabled:bg-[#0F1115]/50 disabled:border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500 transition"
                placeholder="e.g. teacher@gmail.com"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Date of Birth (DOB) <span className="text-slate-400 font-normal">(Used for Staff Birthday Greetings - e.g. DD/MM/YYYY)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  disabled={!isEditing}
                  value={formDataTeacher.dob || ''}
                  onChange={e => setFormDataTeacher({ ...formDataTeacher, dob: e.target.value })}
                  placeholder="DD/MM/YYYY or YYYY-MM-DD"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139] disabled:bg-[#0F1115]/50 disabled:border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500 transition font-mono placeholder:text-slate-600"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute right-4 top-3 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Save Action */}
        {isEditing && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-5 py-3 rounded-xl bg-[#252830] hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-7 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-900/40 transition active:scale-95 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>SAVE PROFILE</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
