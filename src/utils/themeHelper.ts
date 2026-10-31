import { AppSettings, ThemeMode, AccentColorKey, UIAppearance } from '../types';
import { StorageService } from './storage';

export interface AccentColorPreset {
  id: AccentColorKey;
  name: string;
  hex: string;
  gradient: string;
  textColor: string;
  glowColor: string;
}

export const ACCENT_COLOR_PRESETS: AccentColorPreset[] = [
  {
    id: 'purple',
    name: 'Royal Purple',
    hex: '#9333ea',
    gradient: 'from-purple-600 to-indigo-600',
    textColor: 'text-purple-400',
    glowColor: 'rgba(147, 51, 234, 0.35)'
  },
  {
    id: 'indigo',
    name: 'Electric Indigo',
    hex: '#6366f1',
    gradient: 'from-indigo-600 to-blue-600',
    textColor: 'text-indigo-400',
    glowColor: 'rgba(99, 102, 241, 0.35)'
  },
  {
    id: 'blue',
    name: 'Ocean Blue',
    hex: '#2563eb',
    gradient: 'from-blue-600 to-cyan-600',
    textColor: 'text-blue-400',
    glowColor: 'rgba(37, 99, 235, 0.35)'
  },
  {
    id: 'emerald',
    name: 'Emerald Green',
    hex: '#059669',
    gradient: 'from-emerald-600 to-teal-600',
    textColor: 'text-emerald-400',
    glowColor: 'rgba(5, 150, 105, 0.35)'
  },
  {
    id: 'rose',
    name: 'Ruby Rose',
    hex: '#e11d48',
    gradient: 'from-rose-600 to-pink-600',
    textColor: 'text-rose-400',
    glowColor: 'rgba(225, 29, 72, 0.35)'
  },
  {
    id: 'amber',
    name: 'Amber Gold',
    hex: '#d97706',
    gradient: 'from-amber-500 to-orange-600',
    textColor: 'text-amber-400',
    glowColor: 'rgba(217, 119, 6, 0.35)'
  },
  {
    id: 'cyan',
    name: 'Cyber Cyan',
    hex: '#0891b2',
    gradient: 'from-cyan-500 to-blue-600',
    textColor: 'text-cyan-400',
    glowColor: 'rgba(8, 145, 178, 0.35)'
  },
  {
    id: 'teal',
    name: 'Deep Teal',
    hex: '#0d9488',
    gradient: 'from-teal-600 to-emerald-600',
    textColor: 'text-teal-400',
    glowColor: 'rgba(13, 148, 136, 0.35)'
  }
];

export class ThemeManager {
  public static initTheme(): void {
    const settings = this.getThemeSettings();
    this.applyTheme(settings);
  }

  public static getThemeSettings(): AppSettings {
    try {
      return StorageService.getSettings();
    } catch {
      return {
        theme: 'dark',
        accentColor: 'purple',
        customColorHex: '#9333ea',
        uiAppearance: 'modern',
        gradingSystem: 'kerala_hss',
        passingPercentage: 30,
        notificationsEnabled: true,
        autoBackupPrompt: true
      };
    }
  }

  public static saveThemeSettings(settings: AppSettings): void {
    try {
      StorageService.saveSettings(settings);
    } catch (e) {
      console.error('Failed to save theme settings', e);
    }
  }

  public static applyTheme(settings?: Partial<AppSettings>) {
    const root = document.documentElement;
    root.classList.add('dark');
    root.classList.remove('light');
    root.setAttribute('data-theme', 'dark');
    document.body.style.backgroundColor = '#0F1115';
    document.body.style.color = '#F3F4F6';
    root.style.setProperty('--color-primary-accent', '#9333ea');
  }
}
