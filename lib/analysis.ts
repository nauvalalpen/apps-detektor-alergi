/**
 * Mesin Analisis Pemicu Alergi
 * Semua logika berbasis aturan & statistik sederhana — tanpa AI/LLM.
 * 
 * Label: "Indikasi dari data pribadi, bukan diagnosis medis."
 * Selalu sarankan konsultasi dokter / uji alergi resmi.
 */

import type { MealWithItems, ItchEvent, MedicationLog, Medication } from './database.types'
import { parseISO, differenceInHours } from 'date-fns'

export const TIME_WINDOWS = [
  { label: '0-2 jam', minHours: 0, maxHours: 2 },
  { label: '2-6 jam', minHours: 2, maxHours: 6 },
  { label: '6-24 jam', minHours: 6, maxHours: 24 },
  { label: '24-48 jam', minHours: 24, maxHours: 48 },
] as const

export type TimeWindow = typeof TIME_WINDOWS[number]

export interface MedLogWithMed extends MedicationLog {
  medication: Medication
}

export interface AnalysisInput {
  meals: MealWithItems[]
  itchEvents: ItchEvent[]
  medLogs: MedLogWithMed[]
  includeOralDepletionEpisodes?: boolean
}

export interface ItemWindowScore {
  item: string
  window: string
  exposed: number           // jumlah kali item dimakan
  followedByItch: number    // berapa kali diikuti gatal dalam window ini
  ratioItem: number         // followedByItch / exposed
  ratioBaseline: number     // proporsi baseline semua meal yang diikuti gatal
  lift: number              // ratioItem / ratioBaseline
  avgSeverity: number       // rata-rata keparahan gatal yang mengikuti
  confidence: string        // label keyakinan
  isSafe: boolean           // makan >=3x tanpa gatal sama sekali (semua window)
}

export interface OralDepletionStats {
  totalItchEpisodes: number
  depletionEpisodes: number    // episode gatal saat obat sudah melewati interval
  depletionRatio: number
}

export interface AnalysisResult {
  itemScores: ItemWindowScore[]
  safeItems: { item: string; exposedCount: number }[]
  depletionStats: OralDepletionStats
  confounders: {
    stressCorrelation: string
    sleepCorrelation: string
    weatherNotes: string[]
  }
  totalDays: number
  totalItchEpisodes: number
  computedAt: string
}

/** Cek apakah episode gatal terjadi saat obat oral sudah habis */
export function isOralDepletionEpisode(
  itchTime: Date,
  medLogs: MedLogWithMed[],
  toleranceHours = 1
): boolean {
  const oralLogs = medLogs.filter(l => l.medication.kind === 'oral')
  if (oralLogs.length === 0) return false

  // Cari log obat oral terakhir sebelum episode gatal
  const prevLogs = oralLogs
    .filter(l => parseISO(l.taken_at) < itchTime)
    .sort((a, b) => parseISO(b.taken_at).getTime() - parseISO(a.taken_at).getTime())

  if (prevLogs.length === 0) return false

  const lastLog = prevLogs[0]
  const lastMed = lastLog.medication
  const hoursSinceLastDose = differenceInHours(itchTime, parseISO(lastLog.taken_at))

  return hoursSinceLastDose > (lastMed.interval_hours + toleranceHours)
}

/** Hitung jam sejak obat oral terakhir saat gatal */
export function hoursSinceLastOralMed(
  itchTime: Date,
  medLogs: MedLogWithMed[]
): number | null {
  const oralLogs = medLogs.filter(l => l.medication.kind === 'oral')
  const prevLogs = oralLogs
    .filter(l => parseISO(l.taken_at) < itchTime)
    .sort((a, b) => parseISO(b.taken_at).getTime() - parseISO(a.taken_at).getTime())

  if (prevLogs.length === 0) return null
  return differenceInHours(itchTime, parseISO(prevLogs[0].taken_at))
}

/** Analisis utama */
export function runAnalysis(input: AnalysisInput): AnalysisResult {
  const { meals, itchEvents, medLogs, includeOralDepletionEpisodes = false } = input

  // Tandai episode gatal valid (bukan efek obat habis)
  const validItchEvents = itchEvents.filter(event => {
    if (includeOralDepletionEpisodes) return true
    return !isOralDepletionEpisode(parseISO(event.started_at), medLogs)
  })

  const depletionEpisodes = itchEvents.filter(event =>
    isOralDepletionEpisode(parseISO(event.started_at), medLogs)
  )

  // Kumpulkan semua item unik
  const allItems = new Set<string>()
  meals.forEach(meal => meal.meal_items.forEach(item => allItems.add(item.name)))

  const itemScores: ItemWindowScore[] = []
  const allSafeItems: { item: string; exposedCount: number }[] = []

  // Hitung baseline: berapa proporsi meals yang diikuti ANY gatal valid per window
  for (const window of TIME_WINDOWS) {
    const mealCount = meals.length
    const mealsFollowedByItch = meals.filter(meal => {
      const mealTime = parseISO(meal.eaten_at)
      return validItchEvents.some(event => {
        const itchTime = parseISO(event.started_at)
        const hoursAfter = differenceInHours(itchTime, mealTime)
        return hoursAfter >= window.minHours && hoursAfter < window.maxHours
      })
    }).length

    const ratioBaseline = mealCount > 0 ? mealsFollowedByItch / mealCount : 0

    // Per item
    for (const item of allItems) {
      const mealsWithItem = meals.filter(m =>
        m.meal_items.some(mi => mi.name === item)
      )
      const exposed = mealsWithItem.length

      const followedByItchMeals = mealsWithItem.filter(meal => {
        const mealTime = parseISO(meal.eaten_at)
        return validItchEvents.some(event => {
          const itchTime = parseISO(event.started_at)
          const hoursAfter = differenceInHours(itchTime, mealTime)
          return hoursAfter >= window.minHours && hoursAfter < window.maxHours
        })
      })

      const followedByItch = followedByItchMeals.length
      const ratioItem = exposed > 0 ? followedByItch / exposed : 0
      const lift = ratioBaseline > 0 ? ratioItem / ratioBaseline : (ratioItem > 0 ? 99 : 1)

      // Rata-rata severity gatal yang muncul setelah item ini
      const relatedItch = validItchEvents.filter(event => {
        const itchTime = parseISO(event.started_at)
        return mealsWithItem.some(meal => {
          const mealTime = parseISO(meal.eaten_at)
          const hoursAfter = differenceInHours(itchTime, mealTime)
          return hoursAfter >= window.minHours && hoursAfter < window.maxHours
        })
      })

      const avgSeverity = relatedItch.length > 0
        ? relatedItch.reduce((sum, e) => sum + (e.severity ?? 5), 0) / relatedItch.length
        : 0

      const confidence = getConfidenceLabel(lift, exposed)

      itemScores.push({
        item,
        window: window.label,
        exposed,
        followedByItch,
        ratioItem,
        ratioBaseline,
        lift,
        avgSeverity,
        confidence,
        isSafe: false, // dihitung terpisah di bawah
      })
    }
  }

  // Tandai item "kemungkinan aman": dimakan >=3x tanpa PERNAH diikuti gatal di semua window
  for (const item of allItems) {
    const mealsWithItem = meals.filter(m =>
      m.meal_items.some(mi => mi.name === item)
    )
    if (mealsWithItem.length < 3) continue

    const everFollowedByItch = mealsWithItem.some(meal => {
      const mealTime = parseISO(meal.eaten_at)
      return validItchEvents.some(event => {
        const itchTime = parseISO(event.started_at)
        const hoursAfter = differenceInHours(itchTime, mealTime)
        return hoursAfter >= 0 && hoursAfter < 48
      })
    })

    if (!everFollowedByItch) {
      allSafeItems.push({ item, exposedCount: mealsWithItem.length })
      // Tandai di itemScores
      itemScores.forEach(score => {
        if (score.item === item) score.isSafe = true
      })
    }
  }

  // Hapus item safe dari kandidat pemicu
  const triggerScores = itemScores.filter(s => !s.isSafe && s.followedByItch > 0)

  // Hitung hari unik
  const uniqueDates = new Set(meals.map(m => m.eaten_at.split('T')[0]))

  return {
    itemScores: triggerScores.sort((a, b) => b.lift - a.lift),
    safeItems: allSafeItems,
    depletionStats: {
      totalItchEpisodes: itchEvents.length,
      depletionEpisodes: depletionEpisodes.length,
      depletionRatio: itchEvents.length > 0
        ? depletionEpisodes.length / itchEvents.length
        : 0,
    },
    confounders: {
      stressCorrelation: '',  // dihitung di API dengan data daily_context
      sleepCorrelation: '',
      weatherNotes: [],
    },
    totalDays: uniqueDates.size,
    totalItchEpisodes: itchEvents.length,
    computedAt: new Date().toISOString(),
  }
}

function getConfidenceLabel(lift: number, count: number): string {
  if (count < 3) return 'Data belum cukup'
  if (lift < 1.2) return 'Kemungkinan rendah'
  if (lift < 1.8) return 'Kemungkinan sedang'
  return 'Kemungkinan tinggi'
}

/** Top 5 kandidat pemicu per window terbaik per item */
export function getTopTriggers(
  scores: ItemWindowScore[],
  limit = 5
): ItemWindowScore[] {
  // Ambil score tertinggi per item (window apapun)
  const bestPerItem = new Map<string, ItemWindowScore>()
  for (const score of scores) {
    const existing = bestPerItem.get(score.item)
    if (!existing || score.lift > existing.lift) {
      bestPerItem.set(score.item, score)
    }
  }
  return Array.from(bestPerItem.values())
    .sort((a, b) => b.lift - a.lift)
    .slice(0, limit)
}
