import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { getDateWIB } from '@/lib/timezone'
import type { MealWithItems, ItchEvent } from '@/lib/database.types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Severity 1-10 → Tailwind text-color */
export function severityColor(severity: number): string {
  if (severity <= 2) return 'text-emerald-400'
  if (severity <= 4) return 'text-yellow-400'
  if (severity <= 6) return 'text-orange-400'
  if (severity <= 8) return 'text-red-400'
  return 'text-red-600'
}

/** Severity → background+border CSS class names */
export function severityBg(severity: number): string {
  if (severity <= 2) return 'bg-emerald-500/20 border-emerald-500/30'
  if (severity <= 4) return 'bg-yellow-500/20 border-yellow-500/30'
  if (severity <= 6) return 'bg-orange-500/20 border-orange-500/30'
  if (severity <= 8) return 'bg-red-500/20 border-red-500/30'
  return 'bg-red-700/30 border-red-600/40'
}

/** Severity 1-10 → custom CSS class (sev-*) */
export function severityPillClass(severity: number): string {
  if (severity <= 0) return 'sev-none'
  if (severity <= 4) return 'sev-mild'
  if (severity <= 6) return 'sev-medium'
  return 'sev-severe'
}

/** Severity → human-readable label */
export function severityLabel(severity: number | null): string {
  if (!severity || severity <= 0) return 'Tidak gatal'
  if (severity <= 2) return 'Sangat Ringan'
  if (severity <= 4) return 'Ringan'
  if (severity <= 6) return 'Sedang'
  if (severity <= 8) return 'Parah'
  return 'Sangat Parah'
}

/** Calendar cell colour based on max severity that day */
export function calendarDayColor(maxSeverity: number | null): string {
  if (!maxSeverity || maxSeverity <= 0) return 'bg-emerald-500/25 text-emerald-300'
  if (maxSeverity <= 3) return 'bg-yellow-500/25 text-yellow-200'
  if (maxSeverity <= 6) return 'bg-orange-500/25 text-orange-200'
  return 'bg-red-500/25 text-red-200'
}

/** Normalize food item string */
export function normalizeItem(name: string): string {
  return name.toLowerCase().trim()
}

/** 
 * Count unique days that have at least one meal OR one itch event.
 * Use this everywhere instead of computing locally — fixes Bug #1.
 */
export function countCollectedDays(meals: MealWithItems[], itchEvents: ItchEvent[]): number {
  const dates = new Set<string>()
  for (const m of meals) dates.add(getDateWIB(m.eaten_at))
  for (const e of itchEvents) dates.add(getDateWIB(e.started_at))
  return dates.size
}

/** Lift label keyakinan */
export function liftConfidenceLabel(lift: number, count: number): string {
  if (count < 3) return 'Data belum cukup'
  if (lift < 1.2) return 'Kemungkinan rendah'
  if (lift < 1.8) return 'Kemungkinan sedang'
  return 'Kemungkinan tinggi'
}

/** Body areas list */
export const BODY_AREAS = [
  'Tangan kiri',
  'Tangan kanan',
  'Kaki kiri',
  'Kaki kanan',
  'Badan',
  'Wajah',
  'Kepala',
  'Lainnya',
] as const

/** Weather options */
export const WEATHER_OPTIONS = [
  'Panas',
  'Hujan',
  'Berkeringat banyak',
  'AC terus',
  'Lembab',
  'Berangin',
] as const

/** Stress emoji labels */
export const STRESS_EMOJIS: Record<number, string> = {
  1: '😌',
  2: '🙂',
  3: '😐',
  4: '😟',
  5: '😰',
}

export const STRESS_LABELS: Record<number, string> = {
  1: 'Sangat santai',
  2: 'Santai',
  3: 'Biasa',
  4: 'Stres',
  5: 'Sangat stres',
}
