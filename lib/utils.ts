import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Severity 1-10 → warna */
export function severityColor(severity: number): string {
  if (severity <= 2) return 'text-emerald-400'
  if (severity <= 4) return 'text-yellow-400'
  if (severity <= 6) return 'text-orange-400'
  if (severity <= 8) return 'text-red-400'
  return 'text-red-600'
}

export function severityBg(severity: number): string {
  if (severity <= 2) return 'bg-emerald-500/20 border-emerald-500/30'
  if (severity <= 4) return 'bg-yellow-500/20 border-yellow-500/30'
  if (severity <= 6) return 'bg-orange-500/20 border-orange-500/30'
  if (severity <= 8) return 'bg-red-500/20 border-red-500/30'
  return 'bg-red-700/30 border-red-600/40'
}

/** Severity → label teks */
export function severityLabel(severity: number | null): string {
  if (!severity) return 'Tidak ada'
  if (severity <= 2) return 'Sangat Ringan'
  if (severity <= 4) return 'Ringan'
  if (severity <= 6) return 'Sedang'
  if (severity <= 8) return 'Parah'
  return 'Sangat Parah'
}

/** Warna kalender berdasarkan severity tertinggi hari itu */
export function calendarDayColor(maxSeverity: number | null): string {
  if (!maxSeverity) return 'bg-emerald-500/30 text-emerald-300'
  if (maxSeverity <= 3) return 'bg-yellow-500/30 text-yellow-300'
  if (maxSeverity <= 6) return 'bg-orange-500/30 text-orange-300'
  return 'bg-red-500/30 text-red-300'
}

/** Normalize string untuk perbandingan */
export function normalizeItem(name: string): string {
  return name.toLowerCase().trim()
}

/** Lift label keyakinan berdasarkan lift dan jumlah sampel */
export function liftConfidenceLabel(lift: number, count: number): string {
  if (count < 3) return 'Data belum cukup'
  if (lift < 1.2) return 'Kemungkinan rendah'
  if (lift < 1.8) return 'Kemungkinan sedang'
  return 'Kemungkinan tinggi'
}

/** Format area tubuh */
export const BODY_AREAS = [
  'tangan kiri',
  'tangan kanan',
  'kaki kiri',
  'kaki kanan',
  'badan',
  'wajah',
  'lainnya',
] as const

export const WEATHER_OPTIONS = [
  'panas',
  'hujan',
  'berkeringat banyak',
  'AC terus',
  'lembab',
  'berangin',
] as const
