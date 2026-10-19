import { format, formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { id as idLocale } from 'date-fns/locale'
import { differenceInHours, differenceInMinutes, parseISO } from 'date-fns'

/** Label keparahan */
export function severityLabel(severity: number | null): string {
  if (!severity) return 'Tidak ada'
  if (severity <= 2) return 'Sangat Ringan'
  if (severity <= 4) return 'Ringan'
  if (severity <= 6) return 'Sedang'
  if (severity <= 8) return 'Parah'
  return 'Sangat Parah'
}

export const TIMEZONE = 'Asia/Jakarta'

/** Konversi timestamp UTC ke waktu WIB dan format tampilan */
export function toWIB(dateStr: string | Date): Date {
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
  return toZonedTime(date, TIMEZONE)
}

/** Format timestamp untuk ditampilkan: "19 Okt 2026, 15:30" */
export function formatWIB(dateStr: string | Date, fmt = 'dd MMM yyyy, HH:mm'): string {
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
  return formatInTimeZone(date, TIMEZONE, fmt, { locale: idLocale })
}

/** Format hanya jam: "15:30" */
export function formatTimeWIB(dateStr: string | Date): string {
  return formatWIB(dateStr, 'HH:mm')
}

/** Format tanggal saja: "Senin, 19 Oktober 2026" */
export function formatDateWIB(dateStr: string | Date): string {
  return formatWIB(dateStr, 'EEEE, dd MMMM yyyy')
}

/** Format tanggal pendek: "19 Okt" */
export function formatShortDateWIB(dateStr: string | Date): string {
  return formatWIB(dateStr, 'dd MMM')
}

/** Dapatkan tanggal lokal WIB dalam format YYYY-MM-DD */
export function getTodayWIB(): string {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd')
}

/** Dapatkan datetime sekarang dalam format ISO untuk input datetime-local */
export function getNowLocalISO(): string {
  const now = toZonedTime(new Date(), TIMEZONE)
  return format(now, "yyyy-MM-dd'T'HH:mm", { timeZone: TIMEZONE })
}

/** Konversi dari input datetime-local (interpreted as WIB) ke UTC ISO string */
export function localToUTC(localDateStr: string): string {
  // localDateStr: "2026-10-19T15:30" (dianggap WIB)
  // Perlu menambahkan timezone offset WIB (+07:00)
  return new Date(localDateStr + '+07:00').toISOString()
}

/** Hitung selisih jam antara dua timestamp */
export function hoursDiff(from: string | Date, to: string | Date): number {
  const f = typeof from === 'string' ? parseISO(from) : from
  const t = typeof to === 'string' ? parseISO(to) : to
  return differenceInHours(t, f)
}

/** Hitung selisih menit antara dua timestamp */
export function minutesDiff(from: string | Date, to: string | Date): number {
  const f = typeof from === 'string' ? parseISO(from) : from
  const t = typeof to === 'string' ? parseISO(to) : to
  return differenceInMinutes(t, f)
}

/** Format durasi: "3 jam 20 menit" */
export function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 0) return '-'
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (hours === 0) return `${mins} menit`
  if (mins === 0) return `${hours} jam`
  return `${hours} jam ${mins} menit`
}

/** Dapatkan tanggal WIB dari timestamp */
export function getDateWIB(dateStr: string | Date): string {
  return formatWIB(dateStr, 'yyyy-MM-dd')
}

/** Hitung jam sejak obat oral terakhir saat waktu tertentu */
export function hoursSinceLastOralMed(
  atTime: Date,
  medLogs: Array<{ taken_at: string; medication: { kind: string } }>
): number | null {
  const oralLogs = medLogs.filter(l => l.medication.kind === 'oral')
  const prevLogs = oralLogs
    .filter(l => parseISO(l.taken_at) < atTime)
    .sort((a, b) => parseISO(b.taken_at).getTime() - parseISO(a.taken_at).getTime())
  if (prevLogs.length === 0) return null
  return differenceInHours(atTime, parseISO(prevLogs[0].taken_at))
}
