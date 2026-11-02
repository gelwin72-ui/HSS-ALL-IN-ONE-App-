import React, { useState, useMemo, useEffect } from 'react';
import {
  CalendarDays,
  Clock,
  Plus,
  Edit3,
  Trash2,
  Printer,
  Sparkles,
  BookOpen,
  Users,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  Filter,
  Layers,
  ChevronRight,
  School,
  FileSpreadsheet,
  Download,
  Info,
  MapPin,
  RefreshCw,
  Award,
  SlidersHorizontal,
  Flame
} from 'lucide-react';
import {
  TimetableSlot,
  TimetableDay,
  TimetablePeriodType,
  SchoolProfile,
  ClassInfo,
  ClassItem,
  TeacherInfo,
  TeacherAccount
} from '../types';
import {
  StorageService,
  DEFAULT_PERIOD_TIMINGS,
  TIMETABLE_DAYS
} from '../utils/storage';

interface TimetableScreenProps {
  school: SchoolProfile;
  classInfo: ClassInfo;
  classesList: ClassItem[];
  teacher: TeacherInfo;
  activeClassId?: string;
}

export const TimetableScreen: React.FC<TimetableScreenProps> = ({
  school,
  classInfo,
  classesList,
  teacher,
  activeClassId
}) => {
  // Active teacher account from session
  const authSession = StorageService.getAuthSession();
  const currentTeacher = authSession.currentTeacher;
  const activeTeacherId = currentTeacher?.id || '';
  const schoolCode = school?.schoolCode || currentTeacher?.schoolCode || '';

  // View state
  const [viewMode, setViewMode] = useState<'teacher-schedule' | 'class-schedule' | 'today-timeline'>('teacher-schedule');
  const [selectedDay, setSelectedDay] = useState<TimetableDay | 'ALL'>('ALL');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Storage data state
  const [timetables, setTimetables] = useState<TimetableSlot[]>(() => StorageService.getTimetables(schoolCode));
  const [teachersList] = useState<TeacherAccount[]>(() => StorageService.getTeachersBySchoolCode(schoolCode));

  // Edit / Add Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [formData, setFormData] = useState<{
    day: TimetableDay;
    periodNumber: number;
    startTime: string;
    endTime: string;
    subject: string;
    subjectCode: string;
    className: string;
    roomNumber: string;
    type: TimetablePeriodType;
    notes: string;
  }>({
    day: 'Monday',
    periodNumber: 1,
    startTime: '09:30 AM',
    endTime: '10:15 AM',
    subject: 'Physics',
    subjectCode: 'PHY',
    className: classInfo.className || 'Class 12 Science A',
    roomNumber: 'Room 101',
    type: 'lecture',
    notes: ''
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const refreshTimetables = () => {
    const updated = StorageService.getTimetables(schoolCode);
    setTimetables(updated);
  };

  // Filter slots based on active view mode
  const displayedSlots = useMemo(() => {
    let slots = [...timetables];

    if (viewMode === 'teacher-schedule') {
      slots = slots.filter(s => s.teacherId === activeTeacherId || s.teacherName === teacher.teacherName);
    } else if (viewMode === 'class-schedule') {
      const targetClassName = (classInfo?.className || '').trim().toLowerCase();
      if (selectedClassFilter !== 'ALL') {
        slots = slots.filter(s => s.className?.toLowerCase() === selectedClassFilter.toLowerCase());
      } else if (targetClassName) {
        slots = slots.filter(s => s.className?.toLowerCase() === targetClassName);
      }
    }

    if (selectedDay !== 'ALL') {
      slots = slots.filter(s => s.day === selectedDay);
    }

    return slots;
  }, [timetables, viewMode, activeTeacherId, teacher.teacherName, classInfo.className, selectedClassFilter, selectedDay]);

  // Workload Statistics for current teacher
  const teacherStats = useMemo(() => {
    const teacherSlots = timetables.filter(s => s.teacherId === activeTeacherId || s.teacherName === teacher.teacherName);
    const totalPeriods = teacherSlots.length;
    const estimatedHours = (totalPeriods * 45) / 60; // 45 mins per period

    // Distribution by day
    const dayCounts: Record<string, number> = {};
    TIMETABLE_DAYS.forEach(d => { dayCounts[d] = 0; });
    teacherSlots.forEach(s => {
      dayCounts[s.day] = (dayCounts[s.day] || 0) + 1;
    });

    // Unique classes taught
    const classSet = new Set(teacherSlots.map(s => s.className).filter(Boolean));

    return {
      totalPeriods,
      estimatedHours: estimatedHours.toFixed(1),
      classesTaughtCount: classSet.size,
      dayCounts
    };
  }, [timetables, activeTeacherId, teacher.teacherName]);

  // Real-time "Current / Next Period" Indicator
  const currentPeriodStatus = useMemo(() => {
    const now = new Date();
    const days: TimetableDay[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayIndex = now.getDay(); // 0 is Sunday, 1 is Mon...
    if (currentDayIndex === 0) {
      return { isWeekend: true, label: 'Sunday - Weekly Holiday', activeSlot: null, nextSlot: null };
    }
    const todayName = days[currentDayIndex - 1];
    const todaySlots = displayedSlots.filter(s => s.day === todayName).sort((a, b) => a.periodNumber - b.periodNumber);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Helper to convert "09:30 AM" to minutes
    const parseTimeToMinutes = (timeStr: string) => {
      try {
        const [time, modifier] = timeStr.trim().split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      } catch {
        return 0;
      }
    };

    let activeSlot: TimetableSlot | null = null;
    let nextSlot: TimetableSlot | null = null;

    for (const slot of todaySlots) {
      const start = parseTimeToMinutes(slot.startTime);
      const end = parseTimeToMinutes(slot.endTime);
      if (currentMinutes >= start && currentMinutes <= end) {
        activeSlot = slot;
      } else if (currentMinutes < start && !nextSlot) {
        nextSlot = slot;
      }
    }

    return {
      isWeekend: false,
      todayName,
      activeSlot,
      nextSlot,
      totalToday: todaySlots.length
    };
  }, [displayedSlots]);

  const handleOpenAddModal = (day?: TimetableDay, periodNum?: number) => {
    const targetPeriod = periodNum || 1;
    const timing = DEFAULT_PERIOD_TIMINGS[targetPeriod - 1] || DEFAULT_PERIOD_TIMINGS[0];

    setEditingSlot(null);
    setFormData({
      day: day || 'Monday',
      periodNumber: targetPeriod,
      startTime: timing.startTime,
      endTime: timing.endTime,
      subject: teacher.designation?.includes('Physics') ? 'Physics' : teacher.designation?.includes('Computer') ? 'Computer Science' : 'General Higher Secondary',
      subjectCode: 'GEN',
      className: classInfo.className || 'Class 12 Science A',
      roomNumber: 'Room 101',
      type: 'lecture',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (slot: TimetableSlot) => {
    setEditingSlot(slot);
    setFormData({
      day: slot.day,
      periodNumber: slot.periodNumber,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subject: slot.subject,
      subjectCode: slot.subjectCode || '',
      className: slot.className,
      roomNumber: slot.roomNumber || '',
      type: slot.type || 'lecture',
      notes: slot.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim()) {
      showToast('Please enter a valid subject name');
      return;
    }

    const timing = DEFAULT_PERIOD_TIMINGS[formData.periodNumber - 1] || DEFAULT_PERIOD_TIMINGS[0];

    const slotPayload: TimetableSlot = {
      id: editingSlot ? editingSlot.id : `tt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      day: formData.day,
      periodNumber: Number(formData.periodNumber),
      startTime: formData.startTime || timing.startTime,
      endTime: formData.endTime || timing.endTime,
      subject: formData.subject.trim(),
      subjectCode: formData.subjectCode.trim().toUpperCase() || formData.subject.substring(0, 3).toUpperCase(),
      className: formData.className.trim() || classInfo.className,
      classId: activeClassId || classInfo.id,
      teacherId: activeTeacherId,
      teacherName: currentTeacher?.name || teacher.teacherName || 'Faculty Teacher',
      teacherPhone: currentTeacher?.phone || teacher.phone,
      roomNumber: formData.roomNumber.trim(),
      schoolCode: schoolCode,
      type: formData.type,
      notes: formData.notes.trim(),
      createdAt: editingSlot ? editingSlot.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    StorageService.saveTimetableSlot(slotPayload);
    refreshTimetables();
    setIsModalOpen(false);
    showToast(editingSlot ? 'Period slot updated successfully!' : 'New period scheduled successfully!');
  };

  const handleDeleteSlot = (slotId: string) => {
    StorageService.deleteTimetableSlot(slotId);
    refreshTimetables();
    setIsModalOpen(false);
    showToast('Period removed from schedule.');
  };

  const handleAutoGenerateMyTimetable = () => {
    const sampleTeacher: TeacherAccount = currentTeacher || {
      id: activeTeacherId,
      name: teacher.teacherName || 'Class Teacher',
      email: teacher.email || 'teacher@hss.edu',
      phone: teacher.phone || '9847012345',
      schoolName: school.schoolName,
      schoolCode: schoolCode,
      designation: teacher.designation || 'Class Teacher',
      assignedClass: classInfo.className || 'Class 12 Science A',
      createdAt: new Date().toISOString()
    };

    StorageService.generateTeacherStandardTimetable(sampleTeacher, classInfo.className);
    refreshTimetables();
    showToast('Weekly timetable template automatically generated and saved!');
  };

  const handlePrintTimetable = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header Card */}
      <div className="rounded-3xl bg-gradient-to-r from-[#1A1C23] via-[#222530] to-[#1A1C23] border border-[#2D3139] p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300 bg-purple-500/15 px-2.5 py-0.5 rounded-full border border-purple-500/30 flex items-center gap-1">
                <CalendarDays className="w-3 h-3 text-purple-400" />
                Timetable & Academic Scheduler
              </span>
              <span className="text-xs font-mono font-bold text-slate-300 bg-[#0F1115] px-2 py-0.5 rounded-md border border-[#2D3139]">
                {schoolCode}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Weekly Timetable & Period Planner
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              Organize daily periods, laboratory hours, and subject allocations. Synced automatically with School Administration.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              id="btn-auto-schedule-template"
              onClick={handleAutoGenerateMyTimetable}
              className="px-3.5 py-2 rounded-xl bg-[#0F1115] hover:bg-[#252830] border border-[#2D3139] text-purple-300 hover:text-purple-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Pre-fill standard 8-period Higher Secondary schedule"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Auto-Fill Schedule</span>
            </button>

            <button
              type="button"
              id="btn-add-period-slot"
              onClick={() => handleOpenAddModal()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold transition flex items-center gap-1.5 shadow-lg shadow-purple-950/50 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Period Slot</span>
            </button>

            <button
              type="button"
              id="btn-print-timetable"
              onClick={handlePrintTimetable}
              className="p-2 rounded-xl bg-[#2D3139] hover:bg-slate-700 text-slate-200 transition cursor-pointer"
              title="Print Timetable"
            >
              <Printer className="w-4 h-4 text-purple-400" />
            </button>
          </div>
        </div>

        {/* Workload KPI Stats Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 mt-2 border-t border-[#2D3139]/80">
          <div className="p-3 rounded-2xl bg-[#0F1115]/90 border border-[#2D3139]">
            <span className="text-[11px] font-semibold text-slate-400 block">Weekly Periods</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-white">{teacherStats.totalPeriods}</span>
              <span className="text-[10px] text-purple-400 font-bold">Periods/wk</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-[#0F1115]/90 border border-[#2D3139]">
            <span className="text-[11px] font-semibold text-slate-400 block">Teaching Hours</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-white">{teacherStats.estimatedHours}</span>
              <span className="text-[10px] text-emerald-400 font-bold">Hours/wk</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-[#0F1115]/90 border border-[#2D3139]">
            <span className="text-[11px] font-semibold text-slate-400 block">Class Divisions</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-white">{teacherStats.classesTaughtCount}</span>
              <span className="text-[10px] text-sky-400 font-bold">Assigned</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-[#0F1115]/90 border border-[#2D3139]">
            <span className="text-[11px] font-semibold text-slate-400 block">Active Status</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xs font-bold text-amber-300 truncate">
                {currentPeriodStatus.activeSlot ? `Period ${currentPeriodStatus.activeSlot.periodNumber} (${currentPeriodStatus.activeSlot.subject})` : 'Free / Break'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-emerald-950 border border-emerald-500/50 text-emerald-200 text-sm font-semibold shadow-2xl flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* View Mode Tabs & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2D3139] pb-3">
        {/* Switch View Modes */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#1A1C23] border border-[#2D3139]">
          <button
            type="button"
            onClick={() => setViewMode('teacher-schedule')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'teacher-schedule'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>My Schedule</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('class-schedule')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'class-schedule'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Class Timetable</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('today-timeline')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'today-timeline'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Today's Timeline</span>
          </button>
        </div>

        {/* Day & Class Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'class-schedule' && (
            <select
              value={selectedClassFilter}
              onChange={e => setSelectedClassFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#1A1C23] border border-[#2D3139] text-xs font-semibold text-white focus:outline-none focus:border-purple-500"
            >
              <option value="ALL">All Classes / Standard</option>
              {classesList.map(c => (
                <option key={c.id} value={c.className}>{c.className}</option>
              ))}
              {classesList.length === 0 && (
                <option value={classInfo.className}>{classInfo.className}</option>
              )}
            </select>
          )}

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedDay('ALL')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                selectedDay === 'ALL'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'bg-[#1A1C23] text-slate-400 hover:text-white border border-[#2D3139]'
              }`}
            >
              All Days
            </button>
            {TIMETABLE_DAYS.map(day => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                  selectedDay === day
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : 'bg-[#1A1C23] text-slate-400 hover:text-white border border-[#2D3139]'
                }`}
              >
                {day.substring(0, 3)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* VIEW MODE 1 & 2: MASTER WEEKLY GRID VIEW */}
      {(viewMode === 'teacher-schedule' || viewMode === 'class-schedule') && (
        <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-4 sm:p-6 shadow-xl overflow-hidden space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400" />
                {viewMode === 'teacher-schedule' ? `Weekly Schedule: ${teacher.teacherName || currentTeacher?.name}` : `Master Classroom Timetable: ${selectedClassFilter === 'ALL' ? classInfo.className : selectedClassFilter}`}
              </h3>
              <span className="text-xs font-semibold text-slate-400">
                ({displayedSlots.length} periods active)
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
              Click any cell to edit or schedule period
            </span>
          </div>

          {/* Timetable Weekly Matrix Table */}
          <div className="overflow-x-auto border border-[#2D3139] rounded-2xl">
            <table className="w-full text-left text-xs border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-[#0F1115] border-b border-[#2D3139] text-slate-400 font-bold">
                  <th className="p-3.5 w-24 text-center border-r border-[#2D3139]">DAY</th>
                  {DEFAULT_PERIOD_TIMINGS.map(p => (
                    <th key={p.periodNumber} className="p-2.5 text-center border-r border-[#2D3139] last:border-r-0">
                      <span className="text-white font-extrabold block">{p.label}</span>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{p.startTime} - {p.endTime}</span>
                      {p.isBreakAfter && (
                        <span className="text-[9px] text-amber-400/90 font-semibold block">{p.breakLabel}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2D3139]">
                {TIMETABLE_DAYS.filter(d => selectedDay === 'ALL' || selectedDay === d).map(day => (
                  <tr key={day} className="hover:bg-[#222530]/40 transition">
                    {/* Day Column */}
                    <td className="p-3 text-center font-extrabold text-purple-300 bg-[#0F1115]/60 border-r border-[#2D3139]">
                      <span className="block text-xs">{day.toUpperCase()}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {timetables.filter(s => s.day === day && (viewMode === 'class-schedule' || s.teacherId === activeTeacherId)).length} Periods
                      </span>
                    </td>

                    {/* 8 Period Columns */}
                    {DEFAULT_PERIOD_TIMINGS.map(timing => {
                      const slot = displayedSlots.find(s => s.day === day && s.periodNumber === timing.periodNumber);

                      if (slot) {
                        return (
                          <td
                            key={timing.periodNumber}
                            onClick={() => handleOpenEditModal(slot)}
                            className="p-2 border-r border-[#2D3139] last:border-r-0 cursor-pointer hover:bg-purple-600/10 transition align-top"
                          >
                            <div className="p-2 rounded-xl bg-[#0F1115] border border-purple-500/30 hover:border-purple-400 space-y-1 group transition shadow-sm">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[11px] font-extrabold text-white group-hover:text-purple-300 transition truncate">
                                  {slot.subject}
                                </span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                  slot.type === 'lab' || slot.type === 'practical'
                                    ? 'bg-cyan-500/20 text-cyan-300'
                                    : slot.type === 'sports'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-purple-500/20 text-purple-300'
                                }`}>
                                  {slot.type?.toUpperCase() || 'LEC'}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span className="font-semibold text-amber-300 truncate max-w-[85px]">
                                  {slot.className}
                                </span>
                                {slot.roomNumber && (
                                  <span className="font-mono text-slate-400 flex items-center gap-0.5">
                                    <MapPin className="w-2.5 h-2.5 text-purple-400" />
                                    {slot.roomNumber}
                                  </span>
                                )}
                              </div>

                              {viewMode === 'class-schedule' && slot.teacherName && (
                                <span className="text-[10px] text-slate-400 block truncate">
                                  👨‍🏫 {slot.teacherName}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      }

                      // Empty Slot - Click to Add
                      return (
                        <td
                          key={timing.periodNumber}
                          onClick={() => handleOpenAddModal(day, timing.periodNumber)}
                          className="p-2 border-r border-[#2D3139] last:border-r-0 cursor-pointer hover:bg-[#252830]/70 transition text-center align-middle"
                        >
                          <div className="p-2 rounded-xl border border-dashed border-[#2D3139] hover:border-purple-500/50 hover:bg-purple-500/5 text-slate-500 hover:text-purple-300 transition flex flex-col items-center justify-center py-3">
                            <Plus className="w-3.5 h-3.5 mb-0.5" />
                            <span className="text-[9px] font-semibold">Free Period</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW MODE 3: TODAY'S LIVE TIMELINE VIEW */}
      {viewMode === 'today-timeline' && (
        <div className="space-y-4">
          {/* Today Overview Card */}
          <div className="rounded-3xl bg-[#1A1C23] border border-[#2D3139] p-5 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  Today's Active Schedule
                </span>
                <span className="text-xs font-bold text-white">
                  {currentPeriodStatus.todayName || 'School Day'}
                </span>
              </div>
              <h3 className="text-lg font-black text-white mt-1">
                Day Schedule & Current Teaching Status
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Real-time tracking of periods, room venues, and teaching notes for today.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleOpenAddModal(currentPeriodStatus.todayName as TimetableDay)}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-950/50"
            >
              <Plus className="w-4 h-4" />
              <span>Add Period for Today</span>
            </button>
          </div>

          {/* Timeline Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {DEFAULT_PERIOD_TIMINGS.map(timing => {
              const currentDay = (currentPeriodStatus.todayName || 'Monday') as TimetableDay;
              const slot = displayedSlots.find(s => s.day === currentDay && s.periodNumber === timing.periodNumber);
              const isCurrent = currentPeriodStatus.activeSlot?.periodNumber === timing.periodNumber;

              return (
                <div
                  key={timing.periodNumber}
                  className={`p-4 rounded-2xl border transition relative ${
                    isCurrent
                      ? 'bg-purple-600/15 border-purple-500 shadow-lg shadow-purple-950/50 ring-1 ring-purple-500/40'
                      : slot
                      ? 'bg-[#1A1C23] border-[#2D3139] hover:border-slate-600'
                      : 'bg-[#0F1115] border-[#2D3139]/60 opacity-70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                        isCurrent
                          ? 'bg-purple-600 text-white'
                          : slot
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-[#1A1C23] text-slate-500 border border-[#2D3139]'
                      }`}>
                        P{timing.periodNumber}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">
                            {slot ? slot.subject : 'Free Period / Break'}
                          </h4>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black uppercase tracking-wider animate-pulse">
                              🔴 LIVE NOW
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-purple-400" />
                          {timing.startTime} - {timing.endTime}
                        </span>
                      </div>
                    </div>

                    {slot ? (
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(slot)}
                        className="p-1.5 rounded-lg bg-[#0F1115] hover:bg-[#252830] text-slate-300 hover:text-white border border-[#2D3139] transition cursor-pointer"
                        title="Edit Period Slot"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenAddModal(currentDay, timing.periodNumber)}
                        className="px-2.5 py-1 rounded-lg bg-[#1A1C23] hover:bg-purple-600 text-slate-400 hover:text-white text-[11px] font-bold border border-[#2D3139] transition cursor-pointer"
                      >
                        + Schedule
                      </button>
                    )}
                  </div>

                  {slot && (
                    <div className="mt-3 pt-3 border-t border-[#2D3139] flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
                      <span className="font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        {slot.className}
                      </span>
                      {slot.roomNumber && (
                        <span className="text-slate-400 flex items-center gap-1 font-mono">
                          <MapPin className="w-3 h-3 text-purple-400" />
                          {slot.roomNumber}
                        </span>
                      )}
                      {slot.notes && (
                        <p className="w-full text-xs text-slate-400 italic mt-1">
                          "{slot.notes}"
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SLOT EDIT / CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1A1C23] border border-[#2D3139] rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-[#2D3139] pb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  {editingSlot ? 'Edit Timetable Period' : 'Schedule New Period Slot'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-[#2D3139] text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="space-y-3.5 text-xs">
              {/* Day & Period Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Day of Week *</label>
                  <select
                    value={formData.day}
                    onChange={e => setFormData({ ...formData, day: e.target.value as TimetableDay })}
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white font-semibold focus:outline-none focus:border-purple-500"
                  >
                    {TIMETABLE_DAYS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Period Number *</label>
                  <select
                    value={formData.periodNumber}
                    onChange={e => {
                      const pNum = Number(e.target.value);
                      const timing = DEFAULT_PERIOD_TIMINGS[pNum - 1] || DEFAULT_PERIOD_TIMINGS[0];
                      setFormData({
                        ...formData,
                        periodNumber: pNum,
                        startTime: timing.startTime,
                        endTime: timing.endTime
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white font-semibold focus:outline-none focus:border-purple-500"
                  >
                    {DEFAULT_PERIOD_TIMINGS.map(p => (
                      <option key={p.periodNumber} value={p.periodNumber}>
                        {p.label} ({p.startTime} - {p.endTime})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject & Subject Code */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">Subject Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g. Physics / Chemistry"
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Subject Code</label>
                  <input
                    type="text"
                    value={formData.subjectCode}
                    onChange={e => setFormData({ ...formData, subjectCode: e.target.value.toUpperCase() })}
                    placeholder="PHY"
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white uppercase font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Class Name & Room Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Class / Division *</label>
                  <input
                    type="text"
                    required
                    value={formData.className}
                    onChange={e => setFormData({ ...formData, className: e.target.value })}
                    placeholder="Class 12 Science A"
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Room / Lab Venue</label>
                  <input
                    type="text"
                    value={formData.roomNumber}
                    onChange={e => setFormData({ ...formData, roomNumber: e.target.value })}
                    placeholder="Room 101 / Lab 2"
                    className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Period Type */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Period Session Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['lecture', 'lab', 'practical', 'sports'] as TimetablePeriodType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: t })}
                      className={`py-1.5 rounded-xl font-bold uppercase text-[10px] transition cursor-pointer ${
                        formData.type === t
                          ? 'bg-purple-600 text-white'
                          : 'bg-[#0F1115] text-slate-400 border border-[#2D3139]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes / Syllabus Topic */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Curriculum Topic / Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Chapter 4 Electromagnetic Induction derivations"
                  className="w-full px-3 py-2 rounded-xl bg-[#0F1115] border border-[#2D3139] text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-[#2D3139]">
                {editingSlot ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteSlot(editingSlot.id)}
                    className="px-3 py-2 rounded-xl bg-rose-950/50 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Delete Slot</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#2D3139] hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold shadow-lg shadow-purple-950/50 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Period</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
