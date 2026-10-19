'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { runAnalysis, getTopTriggers, type MedLogWithMed } from '@/lib/analysis'
import { formatWIB, formatTimeWIB, getDateWIB } from '@/lib/timezone'
import { FileDown, FileText } from 'lucide-react'
import type { MealWithItems, ItchEvent, Medication, MedicationLog, DailyContext } from '@/lib/database.types'

export function ExportButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false)
  const [loadingCsv, setLoadingCsv] = useState(false)
  const supabase = createClient()

  async function fetchAllData() {
    const [mealsRes, itchRes, medLogsRes, medsRes, contextRes] = await Promise.all([
      supabase.from('meals').select('*, meal_items(*)').eq('user_id', userId).order('eaten_at'),
      supabase.from('itch_events').select('*').eq('user_id', userId).order('started_at'),
      supabase.from('medication_logs').select('*, medication:medications(*)').eq('user_id', userId).order('taken_at'),
      supabase.from('medications').select('*').eq('user_id', userId),
      supabase.from('daily_context').select('*').eq('user_id', userId).order('date'),
    ])
    return {
      meals: (mealsRes.data ?? []) as MealWithItems[],
      itchEvents: (itchRes.data ?? []) as ItchEvent[],
      medLogs: (medLogsRes.data ?? []) as (MedicationLog & { medication: Medication })[],
      medications: (medsRes.data ?? []) as Medication[],
      contexts: (contextRes.data ?? []) as DailyContext[],
    }
  }

  async function handleExportHTML() {
    setLoading(true)
    try {
      const { meals, itchEvents, medLogs, medications, contexts } = await fetchAllData()
      const typedMedLogs = medLogs as MedLogWithMed[]

      const analysis = runAnalysis({ meals, itchEvents, medLogs: typedMedLogs })
      const topTriggers = getTopTriggers(analysis.itemScores, 10)

      const html = generateReportHTML({ meals, itchEvents, medLogs: typedMedLogs, contexts, analysis, topTriggers })

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `alergitrack-laporan-${new Date().toISOString().split('T')[0]}.html`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  async function handleExportCSV() {
    setLoadingCsv(true)
    try {
      const { meals, itchEvents, medLogs } = await fetchAllData()

      const rows: string[] = ['Tipe,Waktu (WIB),Detail,Keparahan,Area Tubuh,Bentol,Catatan']

      meals.forEach(m => {
        const items = (m.meal_items ?? []).map((i: { name: string }) => i.name).join(' | ')
        rows.push(`Makan,${formatWIB(m.eaten_at)},"${items}",-,-,-,"${m.notes ?? ''}"`)
      })

      itchEvents.forEach(e => {
        rows.push(`Gatal,${formatWIB(e.started_at)},-,${e.severity ?? '-'},"${(e.body_areas ?? []).join(' | ')}",${e.has_bumps ? 'Ya' : 'Tidak'},"${e.notes ?? ''}"`)
      })

      medLogs.forEach(l => {
        rows.push(`Obat,${formatWIB(l.taken_at)},"${(l as MedLogWithMed).medication?.name ?? ''}",-,-,-,"${l.notes ?? ''}"`)
      })

      const csv = rows.join('\n')
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `alergitrack-data-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoadingCsv(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleExportHTML} loading={loading} className="w-full" id="btn-export-html">
        <FileText className="w-4 h-4 mr-2" />
        Ekspor Ringkasan (HTML untuk dokter)
      </Button>
      <Button onClick={handleExportCSV} loading={loadingCsv} variant="outline" className="w-full" id="btn-export-csv">
        <FileDown className="w-4 h-4 mr-2" />
        Unduh Data Mentah (CSV)
      </Button>
    </div>
  )
}

function generateReportHTML({ meals, itchEvents, medLogs, contexts, analysis, topTriggers }: {
  meals: MealWithItems[]
  itchEvents: ItchEvent[]
  medLogs: MedLogWithMed[]
  contexts: DailyContext[]
  analysis: ReturnType<typeof runAnalysis>
  topTriggers: ReturnType<typeof getTopTriggers>
}): string {
  const now = formatWIB(new Date().toISOString())

  const triggerRows = topTriggers.map((t, i) => `
    <tr>
      <td>${i + 1}</td>
      <td style="text-transform:capitalize">${t.item}</td>
      <td>${t.window}</td>
      <td>${t.exposed}x</td>
      <td>${t.followedByItch}x (${Math.round(t.ratioItem * 100)}%)</td>
      <td>${t.lift.toFixed(2)}x</td>
      <td>${t.avgSeverity.toFixed(1)}</td>
      <td><strong>${t.confidence}</strong></td>
    </tr>
  `).join('')

  const uniqueDates = [...new Set([
    ...meals.map(m => getDateWIB(m.eaten_at)),
    ...itchEvents.map(e => getDateWIB(e.started_at)),
  ])].sort()

  const dailyRows = uniqueDates.map(date => {
    const dayMeals = meals.filter(m => getDateWIB(m.eaten_at) === date)
    const dayItch = itchEvents.filter(e => getDateWIB(e.started_at) === date)
    const dayCtx = contexts.find(c => c.date === date)
    const maxSev = dayItch.length > 0 ? Math.max(...dayItch.map(e => e.severity ?? 0)) : 0

    return `
      <tr>
        <td>${formatWIB(date + 'T12:00:00+07:00', 'dd MMM yyyy')}</td>
        <td>${dayMeals.map(m => m.meal_items.map((i: { name: string }) => i.name).join(', ')).join(' | ')}</td>
        <td>${dayItch.length > 0 ? `${dayItch.length}x (maks: ${maxSev}/10)` : '-'}</td>
        <td>${dayCtx ? `Stres: ${dayCtx.stress}/5, Tidur: ${dayCtx.sleep_hours}j` : '-'}</td>
      </tr>
    `
  }).join('')

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Laporan AlergiTrack – ${now}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; color: #1a1a1a; }
  h1 { color: #166534; } h2 { color: #166534; border-bottom: 2px solid #bbf7d0; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  th { background: #dcfce7; padding: 8px; text-align: left; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  .warning { background: #fef9c3; border: 1px solid #fde047; padding: 12px; border-radius: 8px; margin: 16px 0; }
  .disclaimer { background: #fee2e2; border: 1px solid #fca5a5; padding: 12px; border-radius: 8px; margin: 16px 0; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
<h1>🌿 Laporan AlergiTrack</h1>
<p>Diekspor: ${now} WIB · ${uniqueDates.length} hari data</p>

<div class="disclaimer">
  ⚠️ <strong>PENTING:</strong> Hasil ini adalah indikasi dari data pribadi, BUKAN diagnosis medis.
  Harap didiskusikan dengan dokter Anda. Pertimbangkan uji alergi resmi (skin prick test / patch test).
</div>

<h2>Ringkasan Statistik</h2>
<table>
  <tr><th>Total hari data</th><td>${uniqueDates.length} hari</td></tr>
  <tr><th>Total episode gatal</th><td>${itchEvents.length} episode</td></tr>
  <tr><th>Episode saat obat habis</th><td>${analysis.depletionStats.depletionEpisodes} episode (${Math.round(analysis.depletionStats.depletionRatio * 100)}%)</td></tr>
  <tr><th>Item aman (dimakan 3x+ tanpa gatal)</th><td>${analysis.safeItems.map(s => s.item).join(', ') || '-'}</td></tr>
</table>

<h2>Kandidat Pemicu Teratas</h2>
<table>
  <thead><tr>
    <th>#</th><th>Item</th><th>Window</th><th>Dimakan</th><th>Diikuti Gatal</th><th>Lift</th><th>Avg Parah</th><th>Keyakinan</th>
  </tr></thead>
  <tbody>${triggerRows}</tbody>
</table>
<p style="font-size:12px;color:#666">Lift > 1 = item lebih sering diikuti gatal. Rasio dasar = rata-rata semua makanan.</p>

<h2>Log Harian</h2>
<table>
  <thead><tr><th>Tanggal</th><th>Makanan</th><th>Gatal</th><th>Konteks</th></tr></thead>
  <tbody>${dailyRows}</tbody>
</table>

<p style="font-size:11px;color:#999;margin-top:24px">
  Dibuat oleh AlergiTrack – Aplikasi Jurnal Alergi Pribadi
</p>
</body>
</html>`
}
