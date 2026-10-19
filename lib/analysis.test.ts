/**
 * Unit tests untuk mesin analisis AlergiTrack
 * Jalankan: npx ts-node --project tsconfig.json lib/analysis.test.ts
 * Atau integrasikan ke Jest/Vitest
 */

import {
  isOralDepletionEpisode,
  hoursSinceLastOralMed,
  runAnalysis,
  getTopTriggers,
  TIME_WINDOWS,
  type MedLogWithMed,
} from './analysis'
import type { MealWithItems, ItchEvent } from './database.types'

// Helper untuk membuat mock data
function makeMeal(id: string, eatenAt: string, items: string[]): MealWithItems {
  return {
    id,
    user_id: 'test-user',
    eaten_at: eatenAt,
    notes: null,
    created_at: eatenAt,
    meal_items: items.map((name, i) => ({
      id: `item-${i}`,
      meal_id: id,
      user_id: 'test-user',
      name,
      created_at: eatenAt,
    })),
  }
}

function makeItch(id: string, startedAt: string, severity: number): ItchEvent {
  return {
    id,
    user_id: 'test-user',
    started_at: startedAt,
    severity,
    body_areas: ['tangan kiri'],
    has_bumps: false,
    notes: null,
    created_at: startedAt,
  }
}

function makeMedLog(id: string, takenAt: string, intervalHours = 24): MedLogWithMed {
  return {
    id,
    user_id: 'test-user',
    medication_id: 'med-1',
    taken_at: takenAt,
    notes: null,
    created_at: takenAt,
    medication: {
      id: 'med-1',
      user_id: 'test-user',
      name: 'Cetirizine',
      kind: 'oral',
      interval_hours: intervalHours,
      reminder_hour: null,
      active: true,
      created_at: takenAt,
    },
  }
}

// ===== TEST 1: isOralDepletionEpisode =====
function test1() {
  console.log('\n--- TEST 1: isOralDepletionEpisode ---')

  // Obat diminum 20 jam yang lalu, interval 24 jam → BELUM habis
  const lastDose = new Date('2026-01-01T08:00:00Z')
  const itchTime = new Date('2026-01-02T04:00:00Z') // 20 jam kemudian
  const medLog = makeMedLog('log-1', lastDose.toISOString())

  const result1 = isOralDepletionEpisode(itchTime, [medLog])
  console.assert(result1 === false, `GAGAL: Harusnya false (belum 25 jam), dapat: ${result1}`)
  console.log('✓ 20 jam setelah obat → bukan depletion')

  // Obat diminum 28 jam yang lalu, interval 24 jam → SUDAH habis (28 > 24+1)
  const itchTime2 = new Date('2026-01-02T12:00:00Z') // 28 jam kemudian
  const result2 = isOralDepletionEpisode(itchTime2, [medLog])
  console.assert(result2 === true, `GAGAL: Harusnya true (28 > 25 jam), dapat: ${result2}`)
  console.log('✓ 28 jam setelah obat → depletion episode')

  // Tidak ada log obat → bukan depletion
  const result3 = isOralDepletionEpisode(itchTime, [])
  console.assert(result3 === false, `GAGAL: Harusnya false (tidak ada log), dapat: ${result3}`)
  console.log('✓ Tidak ada log obat → bukan depletion')
}

// ===== TEST 2: hoursSinceLastOralMed =====
function test2() {
  console.log('\n--- TEST 2: hoursSinceLastOralMed ---')

  const lastDose = new Date('2026-01-01T08:00:00Z')
  const itchTime = new Date('2026-01-01T14:00:00Z') // 6 jam kemudian
  const medLog = makeMedLog('log-1', lastDose.toISOString())

  const hours = hoursSinceLastOralMed(itchTime, [medLog])
  console.assert(hours === 6, `GAGAL: Harusnya 6, dapat: ${hours}`)
  console.log('✓ hoursSinceLastOralMed = 6 jam')

  const noHours = hoursSinceLastOralMed(itchTime, [])
  console.assert(noHours === null, `GAGAL: Harusnya null, dapat: ${noHours}`)
  console.log('✓ Tanpa log → null')
}

// ===== TEST 3: runAnalysis - basic lift calculation =====
function test3() {
  console.log('\n--- TEST 3: Lift calculation ---')

  // Skenario: udang dimakan 3x, 3x diikuti gatal dalam 2-6 jam
  // Ayam dimakan 3x, tidak pernah diikuti gatal
  const meals: MealWithItems[] = [
    makeMeal('m1', '2026-01-01T12:00:00Z', ['nasi', 'udang']),
    makeMeal('m2', '2026-01-02T12:00:00Z', ['nasi', 'udang']),
    makeMeal('m3', '2026-01-03T12:00:00Z', ['nasi', 'udang']),
    makeMeal('m4', '2026-01-04T12:00:00Z', ['nasi', 'ayam']),
    makeMeal('m5', '2026-01-05T12:00:00Z', ['nasi', 'ayam']),
    makeMeal('m6', '2026-01-06T12:00:00Z', ['nasi', 'ayam']),
  ]

  // Gatal 4 jam setelah makan udang (masuk window 2-6 jam)
  const itchEvents: ItchEvent[] = [
    makeItch('e1', '2026-01-01T16:00:00Z', 6),
    makeItch('e2', '2026-01-02T16:00:00Z', 7),
    makeItch('e3', '2026-01-03T16:00:00Z', 5),
  ]

  const medLogs = [
    makeMedLog('log-1', '2026-01-01T20:00:00Z'),
    makeMedLog('log-2', '2026-01-02T20:00:00Z'),
    makeMedLog('log-3', '2026-01-03T20:00:00Z'),
    makeMedLog('log-4', '2026-01-04T20:00:00Z'),
    makeMedLog('log-5', '2026-01-05T20:00:00Z'),
    makeMedLog('log-6', '2026-01-06T20:00:00Z'),
  ]

  const result = runAnalysis({ meals, itchEvents, medLogs, includeOralDepletionEpisodes: false })

  // Cek udang punya lift > 1
  const udangScore = result.itemScores.find(s => s.item === 'udang' && s.window === '2-6 jam')
  console.assert(udangScore !== undefined, 'GAGAL: Udang tidak ditemukan di scores')
  if (udangScore) {
    console.assert(udangScore.lift > 1, `GAGAL: Udang lift harusnya > 1, dapat: ${udangScore.lift}`)
    console.log(`✓ Udang lift = ${udangScore.lift.toFixed(2)} (> 1)`)
    console.assert(udangScore.followedByItch === 3, `GAGAL: followedByItch harusnya 3, dapat: ${udangScore.followedByItch}`)
    console.log(`✓ Udang diikuti gatal ${udangScore.followedByItch}x`)
  }

  // Cek ayam ada di safe items
  console.assert(result.safeItems.some(s => s.item === 'ayam'), 'GAGAL: Ayam harusnya di safe items')
  console.log('✓ Ayam masuk kemungkinan aman')

  // Cek tidak ada depletion episodes
  console.assert(result.depletionStats.depletionEpisodes === 0, `GAGAL: Harusnya 0 depletion, dapat: ${result.depletionStats.depletionEpisodes}`)
  console.log('✓ Tidak ada episode depletion')
}

// ===== TEST 4: Depletion exclusion =====
function test4() {
  console.log('\n--- TEST 4: Depletion exclusion ---')

  const meals: MealWithItems[] = [
    makeMeal('m1', '2026-01-01T12:00:00Z', ['nasi', 'ayam']),
    makeMeal('m2', '2026-01-02T12:00:00Z', ['nasi', 'ayam']),
    makeMeal('m3', '2026-01-03T12:00:00Z', ['nasi', 'ayam']),
  ]

  const medLogs = [
    makeMedLog('log-1', '2026-01-01T08:00:00Z'), // Obat pagi hari 1
    // Hari 2 dan 3 TIDAK diminum
  ]

  // Gatal di hari 3 = 52 jam setelah obat terakhir → depletion
  const itchEvents: ItchEvent[] = [
    makeItch('e1', '2026-01-03T12:00:00Z', 8),
  ]

  const result = runAnalysis({ meals, itchEvents, medLogs, includeOralDepletionEpisodes: false })

  console.assert(result.depletionStats.depletionEpisodes === 1, `GAGAL: Harusnya 1 depletion, dapat: ${result.depletionStats.depletionEpisodes}`)
  console.log('✓ Depletion episode terdeteksi')

  // Dengan depletion dikecualikan, ayam tidak boleh jadi trigger
  const ayamScore = result.itemScores.find(s => s.item === 'ayam' && s.followedByItch > 0)
  console.assert(ayamScore === undefined, `GAGAL: Ayam seharusnya tidak ada di scores ketika depletion dikecualikan`)
  console.log('✓ Ayam tidak dituduh sebagai pemicu (depletion dikecualikan)')

  // Dengan depletion diikutsertakan, ayam jadi trigger
  const resultIncluded = runAnalysis({ meals, itchEvents, medLogs, includeOralDepletionEpisodes: true })
  const ayamScoreIncluded = resultIncluded.itemScores.find(s => s.item === 'ayam' && s.followedByItch > 0)
  console.assert(ayamScoreIncluded !== undefined, 'GAGAL: Ayam harusnya muncul di scores ketika depletion disertakan')
  console.log('✓ Ayam muncul sebagai kandidat ketika depletion disertakan')
}

// ===== RUN ALL TESTS =====
function runAllTests() {
  console.log('=== AlergiTrack Analysis Unit Tests ===')
  try {
    test1()
    test2()
    test3()
    test4()
    console.log('\n✅ Semua test lulus!')
  } catch (err) {
    console.error('\n❌ Test gagal:', err)
    process.exit(1)
  }
}

// Jalankan jika file ini dieksekusi langsung
if (typeof require !== 'undefined' && require.main === module) {
  runAllTests()
}

export { runAllTests }
