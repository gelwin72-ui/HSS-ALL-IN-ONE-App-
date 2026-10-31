import React, { useState } from 'react';
import { Bell, Calendar, Clock, Plus, Trash2, CheckCircle2, Circle, X } from 'lucide-react';
import { Reminder } from '../types';

interface ReminderModalProps {
  isOpen: boolean;
  reminders: Reminder[];
  onClose: () => void;
  onSaveReminder: (reminder: Reminder) => void;
  onToggleComplete: (id: string) => void;
  onDeleteReminder: (id: string) => void;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  reminders,
  onClose,
  onSaveReminder,
  onToggleComplete,
  onDeleteReminder
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('09:30');
  const [category, setCategory] = useState<Reminder['category']>('attendance');
  const [repeat, setRepeat] = useState<Reminder['repeat']>('none');

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newReminder: Reminder = {
      id: `rem-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || undefined,
      date,
      time,
      category,
      repeat,
      isCompleted: false,
      createdAt: new Date().toISOString()
    };

    onSaveReminder(newReminder);
    setTitle('');
    setDescription('');
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-3xl bg-[#1A1C23] border border-[#2D3139] shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2D3139] bg-[#1A1C23]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">Teacher Reminders & Tasks</h3>
              <p className="text-xs text-slate-400">Manage daily class schedules & alerts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#252830] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed border-purple-500/30 text-purple-300 bg-purple-500/5 hover:bg-purple-500/10 transition font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Reminder</span>
            </button>
          ) : (
            <form onSubmit={handleAdd} className="p-4 rounded-2xl bg-[#0F1115] border border-purple-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">New Task Reminder</h4>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Reminder Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Submit Mid-Term Marks"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#1A1C23] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Description / Notes</label>
                <input
                  type="text"
                  placeholder="Optional details or instructions"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#1A1C23] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#1A1C23] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Time</label>
                  <input
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#1A1C23] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#1A1C23] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="attendance">Attendance</option>
                    <option value="marks">Marks Entry</option>
                    <option value="exam">Exam Duty</option>
                    <option value="meeting">PTA / Meeting</option>
                    <option value="general">General Task</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Repeat</label>
                  <select
                    value={repeat}
                    onChange={e => setRepeat(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#1A1C23] border border-[#2D3139] text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="none">Once</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-semibold text-sm text-white shadow-lg transition"
                >
                  Save Reminder
                </button>
              </div>
            </form>
          )}

          {/* List of Reminders */}
          <div className="space-y-2">
            {reminders.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                No reminders created yet. Tap above to schedule.
              </div>
            ) : (
              reminders.map(rem => (
                <div
                  key={rem.id}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border transition ${
                    rem.isCompleted
                      ? 'bg-[#0F1115]/40 border-[#2D3139]/60 opacity-60'
                      : 'bg-[#0F1115] border-[#2D3139] hover:border-slate-600'
                  }`}
                >
                  <button
                    onClick={() => onToggleComplete(rem.id)}
                    className="mt-0.5 text-slate-400 hover:text-purple-400 transition"
                  >
                    {rem.isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${rem.isCompleted ? 'line-through text-slate-400' : 'text-white'}`}>
                      {rem.title}
                    </p>
                    {rem.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{rem.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-purple-400" /> {rem.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-blue-400" /> {rem.time}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#252830] text-[10px] uppercase font-bold text-slate-300">
                        {rem.category}
                      </span>
                      {rem.repeat !== 'none' && (
                        <span className="text-emerald-400 font-semibold uppercase text-[10px]">
                          {rem.repeat}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteReminder(rem.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-[#252830] transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2D3139] bg-[#1A1C23] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-[#252830] text-slate-300 hover:text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
