'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/badge'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine
} from 'recharts'
import {
  runAnalysis, getTopTriggers, isOralDepletionEpisode, TIME_WINDOWS,
  type MedLogWithMed, type ItemWindowScore
} from '@/lib/analysis'
import { formatShortDateWIB, getDateWIB, hoursSinceLastOralMed } from '@/lib/timezone'
import { cn, severityColor, countCollectedDays } from '@/lib/utils'
import { parseISO, differenceInDays, subDays, format } from 'date-fns'
import {
  Activity, TrendingDown, TrendingUp, Shield, AlertTriangle, Zap,
  ChevronDown, ChevronRight, Info, CheckCircle2, ToggleLeft, ToggleRight
} from 'lucide-react'
import type { MealWithItems, ItchEvent, Medication, MedicationLog } from '@/lib/database.types'

interface WawasanPageProps {
  meals: MealWithItems[]
  itchEvents: ItchEvent[]
  medLogs: (MedicationLog & { medication: Medication })[]
  medications: Medication[]
  userId: string
}

// Threshold: need ≥7 days of data AND at least one item with ≥3 exposures
function meetsAnalysisThreshold(totalDays: number, itemScores: ItemWindowScore[]): boolean {
  if (totalDays < 7) return false
  const uniqueItems = new Set(itemScores.map(s => s.item))
  for (const item of uniqueItems) {
    const scores = itemScores.filter(s => s.item === item)
    if (scores.some(s => s.exposed >= 3)) return true
  }
  return false
}

export function WawasanPage({ meals, itchEvents, medLogs, medications, userId }: WawasanPageProps) {
  const [liveItch, setLiveItch] = useState(itchEvents)
  const [liveMedLogs, setLiveMedLogs] = useState(medLogs)
  const [includeDepletion, setIncludeDepletion] = useState(false)
  const [selectedTrigger, setSelectedTrigger] = useState<ItemWindowScore | null>(null)
  const [showTriggerDetail, setShowTriggerDetail] = useState(false)
  const supabase = createClient()

  // Realtime
  useEffect(() => {
    const channel = supabase.channel(`wawasan-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'itch_events', filter: `user_id=eq.${userId}` },
        payload => setLiveItch(prev => [...prev, payload.new as ItchEvent].sort((a, b) => a.started_at.localeCompare(b.started_at)))
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'medication_logs', filter: `user_id=eq.${userId}` },
        payload => {
          const newLog = payload.new as MedicationLog
          const med = medications.find(m => m.id === newLog.medication_id)
          if (med) setLiveMedLogs(prev => [...prev, { ...newLog, medication: med }])
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, medications])

  const typedMedLogs = liveMedLogs as MedLogWithMed[]

  // Stats
  const now = new Date()
  const oneWeekAgo = subDays(now, 7)
  const twoWeeksAgo = subDays(now, 14)

  const thisWeekItch = liveItch.filter(e => parseISO(e.started_at) >= oneWeekAgo)
  const lastWeekItch = liveItch.filter(e => parseISO(e.started_at) >= twoWeeksAgo && parseISO(e.started_at) < oneWeekAgo)

  const thisWeekAvgSev = thisWeekItch.length > 0
    ? thisWeekItch.reduce((s, e) => s + (e.severity ?? 5), 0) / thisWeekItch.length : 0
  const lastWeekAvgSev = lastWeekItch.length > 0
    ? lastWeekItch.reduce((s, e) => s + (e.severity ?? 5), 0) / lastWeekItch.length : 0

  // Consecutive no-itch days
  let consecutiveNoItch = 0
  for (let i = 0; i < 30; i++) {
    const d = format(subDays(now, i), 'yyyy-MM-dd')
    if (liveItch.some(e => getDateWIB(e.started_at) === d)) break
    consecutiveNoItch++
  }

  // Collected days (Bug #1 fix shared)
  const totalDays = countCollectedDays(meals, liveItch)

  // Analysis
  const analysisResult = useMemo(() => {
    return runAnalysis({ meals, itchEvents: liveItch, medLogs: typedMedLogs, includeOralDepletionEpisodes: includeDepletion })
  }, [meals, liveItch, typedMedLogs, includeDepletion])

  const topTriggers = useMemo(() => getTopTriggers(analysisResult.itemScores, 10), [analysisResult])
  const canShowResults = meetsAnalysisThreshold(totalDays, analysisResult.itemScores)

  // Items in progress (not yet enough exposure)
  const itemsInProgress = useMemo(() => {
    const allItems = new Set<string>()
    meals.forEach(meal => meal.meal_items.forEach(item => allItems.add(item.name)))
    return Array.from(allItems).map(item => {
      const scores = analysisResult.itemScores.filter(s => s.item === item)
      const exposed = scores.length > 0 ? scores[0].exposed : meals.filter(m => m.meal_items.some(mi => mi.name === item)).length
      return { item, exposed }
    }).filter(({ exposed }) => exposed < 3)
  }, [meals, analysisResult])

  // Charts
  const dailyChartData = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const d = format(subDays(now, 29 - i), 'yyyy-MM-dd')
    const dayItch = liveItch.filter(e => getDateWIB(e.started_at) === d)
    const maxSev = dayItch.length > 0 ? Math.max(...dayItch.map(e => e.severity ?? 0)) : 0
    const medTaken = typedMedLogs.some(l => getDateWIB(l.taken_at) === d && l.medication.kind === 'oral')
    return {
      date: formatShortDateWIB(d + 'T12:00:00+07:00'),
      keparahan: maxSev || null,
      obat: medTaken ? 9.5 : null,
    }
  }), [liveItch, typedMedLogs])

  const depletionHistogram = useMemo(() => {
    const buckets = [
      { label: '0-6j', min: 0, max: 6, count: 0 },
      { label: '6-12j', min: 6, max: 12, count: 0 },
      { label: '12-18j', min: 12, max: 18, count: 0 },
      { label: '18-24j', min: 18, max: 24, count: 0 },
      { label: '24-30j', min: 24, max: 30, count: 0 },
      { label: '>30j', min: 30, max: 999, count: 0 },
    ]
    liveItch.forEach(event => {
      const hours = hoursSinceLastOralMed(parseISO(event.started_at), typedMedLogs)
      if (hours === null) return
      const bucket = buckets.find(b => hours >= b.min && hours < b.max)
      if (bucket) bucket.count++
    })
    return buckets
  }, [liveItch, typedMedLogs])

  const itchTrend = thisWeekItch.length - lastWeekItch.length
  const sevTrend = thisWeekAvgSev - lastWeekAvgSev

  const progressStatus = totalDays >= 14
    ? 'Cukup data untuk analisis lengkap.'
    : totalDays >= 7
      ? 'Analisis dasar tersedia. Terus catat setiap hari untuk hasil lebih akurat.'
      : 'Belum cukup data untuk menyimpulkan. Terus catat setiap hari, termasuk hari tanpa gatal.'

  return (
    <div className="px-4 pt-4 pb-2 space-y-4 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Wawasan</h1>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm text-emerald-400 font-medium">Live</span>
        </div>
      </div>

      {/* ── 1. Progress card ── */}
      <div className="rounded-2xl border border-primary/20 bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold">Data terkumpul</p>
          <span className="text-2xl font-bold text-primary">{totalDays}<span className="text-base text-muted-foreground">/14</span></span>
        </div>
        <Progress value={totalDays} max={14} color="auto" />
        <p className="text-sm text-muted-foreground leading-relaxed">{progressStatus}</p>
      </div>

      {/* ── 2. 3 stat cards ── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Gatal minggu ini */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-3xl font-bold">{thisWeekItch.length}</p>
          <p className="text-sm text-muted-foreground mt-1">Gatal minggu ini</p>
          <div className={cn(
            'flex items-center gap-1 text-sm font-medium mt-1',
            itchTrend < 0 ? 'text-emerald-400' : itchTrend > 0 ? 'text-red-400' : 'text-muted-foreground'
          )}>
            {itchTrend < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : itchTrend > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : null}
            {itchTrend !== 0 ? `${itchTrend > 0 ? '+' : ''}${itchTrend} vs minggu lalu` : '= minggu lalu'}
          </div>
        </div>

        {/* Avg severity */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className={cn('text-3xl font-bold', thisWeekAvgSev > 0 ? severityColor(Math.round(thisWeekAvgSev)) : 'text-muted-foreground')}>
            {thisWeekAvgSev > 0 ? thisWeekAvgSev.toFixed(1) : '–'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Rata-rata parah</p>
          {lastWeekAvgSev > 0 && (
            <p className={cn('text-sm font-medium mt-1', sevTrend < 0 ? 'text-emerald-400' : sevTrend > 0 ? 'text-red-400' : 'text-muted-foreground')}>
              {sevTrend !== 0 ? `${sevTrend > 0 ? '+' : ''}${sevTrend.toFixed(1)}` : '= sama'}
            </p>
          )}
        </div>

        {/* Consecutive no-itch */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-3xl font-bold text-emerald-400">{consecutiveNoItch}</p>
          <p className="text-sm text-muted-foreground mt-1">Hari tanpa gatal berturut</p>
        </div>
      </div>

      {/* ── 3. Pengaruh obat card ── */}
      {typedMedLogs.some(l => l.medication.kind === 'oral') && (
        <div className={cn(
          'rounded-2xl border p-4',
          analysisResult.depletionStats.depletionRatio > 0.3
            ? 'border-red-800/50 bg-red-950/15'
            : 'border-border bg-card'
        )}>
          <div className="flex items-start gap-3 mb-3">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
              analysisResult.depletionStats.depletionRatio > 0.3
                ? 'bg-red-500/20 border border-red-500/30'
                : 'bg-amber-500/15 border border-amber-500/25'
            )}>
              <AlertTriangle className={cn('w-5 h-5', analysisResult.depletionStats.depletionRatio > 0.3 ? 'text-red-400' : 'text-amber-400')} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Pengaruh Obat Habis</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {analysisResult.depletionStats.depletionEpisodes} dari {analysisResult.depletionStats.totalItchEpisodes} episode gatal terjadi saat obat sudah melewati jadwal
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between bg-secondary/50 rounded-xl px-4 py-3">
            <p className="text-sm font-medium">Sertakan episode obat habis dalam analisis makanan</p>
            <button
              onClick={() => setIncludeDepletion(!includeDepletion)}
              role="switch"
              aria-checked={includeDepletion}
              className="shrink-0 ml-3"
            >
              {includeDepletion
                ? <ToggleRight className="w-7 h-7 text-primary" />
                : <ToggleLeft className="w-7 h-7 text-muted-foreground" />
              }
            </button>
          </div>
        </div>
      )}

      {/* ── 4. Kandidat pemicu ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-base font-semibold">Kandidat Pemicu</h2>
        </div>

        {!canShowResults ? (
          /* Not enough data — show in-progress list, not rankings (Bug #3 fix) */
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-950/20 rounded-xl px-3 py-2">
              <Info className="w-4 h-4 shrink-0" />
              <p>Hasil muncul setelah setiap makanan tercatat minimal 3 kali dan data ≥7 hari.</p>
            </div>
            {itemsInProgress.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">Sedang dikumpulkan:</p>
                {itemsInProgress.slice(0, 8).map(({ item, exposed }) => (
                  <div key={item} className="flex items-center gap-3">
                    <p className="flex-1 text-base capitalize">{item}</p>
                    <div className="flex items-center gap-1.5">
                      <div className="flex gap-0.5">
                        {[1, 2, 3].map(i => (
                          <div key={i} className={cn(
                            'w-4 h-4 rounded-sm border',
                            i <= exposed ? 'bg-primary/40 border-primary/50' : 'bg-secondary border-border'
                          )} />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">{exposed}/3×</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Mulai catat makan untuk mengumpulkan data.
              </p>
            )}
          </div>
        ) : (
          /* Enough data — show results (Bug #6 fix: show only items with ≥3 exposures) */
          <div className="divide-y divide-border">
            {topTriggers.filter(t => t.exposed >= 3).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6 px-4">
                Belum ada pola signifikan dari data yang ada.
              </p>
            ) : (
              topTriggers.filter(t => t.exposed >= 3).map((score, idx) => (
                <TriggerRow
                  key={`${score.item}-${score.window}`}
                  score={score}
                  rank={idx + 1}
                  onTap={() => { setSelectedTrigger(score); setShowTriggerDetail(true) }}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* ── 5. Kemungkinan aman ── */}
      {analysisResult.safeItems.length > 0 && (
        <div className="rounded-2xl border border-emerald-800/30 bg-emerald-950/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-emerald-400" />
            <p className="font-semibold">Kemungkinan Aman</p>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Dimakan ≥3× tanpa diikuti gatal dalam 48 jam. Bukan jaminan — bisa berubah dengan data lebih banyak.
          </p>
          <div className="flex flex-wrap gap-2">
            {analysisResult.safeItems.map(item => (
              <div key={item.item} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/30 border border-emerald-800/40 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-sm text-emerald-300 capitalize">{item.item}</span>
                <span className="text-xs text-muted-foreground">({item.exposedCount}×)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 6. Faktor lain ── */}
      {totalDays >= 7 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-primary" />
            <p className="font-semibold">Faktor Lain yang Perlu Dicatat</p>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Tingkat stres', hint: 'Catat di Konteks Harian setiap hari' },
              { label: 'Jam tidur', hint: 'Tidur kurang sering memperparah eksim' },
              { label: 'Cuaca / suhu', hint: 'Panas, berkeringat, AC terus' },
              { label: 'Produk baru', hint: 'Sabun, deterjen, lotion baru' },
            ].map(({ label, hint }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                <div>
                  <p className="text-base font-medium">{label}</p>
                  <p className="text-sm text-muted-foreground">{hint}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 7a. Chart: keparahan 30 hari ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="font-semibold">Keparahan Gatal 30 Hari</p>
          <p className="text-sm text-muted-foreground mt-0.5">Titik kuning = obat oral diminum hari itu</p>
        </div>
        <div className="p-4">
          {dailyChartData.every(d => d.keparahan === null) ? (
            <p className="text-center text-sm text-muted-foreground py-8">Belum ada episode gatal dalam 30 hari terakhir.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} interval={4} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '13px' }}
                  labelStyle={{ color: 'var(--color-foreground)' }}
                />
                <Line type="monotone" dataKey="keparahan" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, fill: '#f59e0b' }} connectNulls={false} name="Keparahan" />
                <Line type="monotone" dataKey="obat" stroke="#4ade9a" strokeWidth={0} dot={{ r: 5, fill: '#4ade9a', strokeWidth: 0 }} name="Obat diminum" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── 7b. Chart: jam sejak obat ── */}
      {typedMedLogs.some(l => l.medication.kind === 'oral') && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="font-semibold">Gatal vs Jam Sejak Obat Terakhir</p>
            <p className="text-sm text-muted-foreground mt-0.5">Apakah gatal menumpuk saat obat sudah lama?</p>
          </div>
          <div className="p-4">
            {depletionHistogram.every(d => d.count === 0) ? (
              <p className="text-center text-sm text-muted-foreground py-8">Belum ada data gatal dengan riwayat obat.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={depletionHistogram} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '13px' }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(val: any) => [`${val} episode`, 'Jumlah gatal']}
                  />
                  <ReferenceLine x="24-30j" stroke="#ef4444" strokeDasharray="4 2" />
                  <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Episode gatal" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── Disclaimer — once, at bottom ── */}
      <div className="rounded-2xl border border-amber-800/30 bg-amber-950/10 p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-300/80 leading-relaxed">
            Ini indikasi dari data pribadimu, <strong>bukan diagnosis</strong>. Bahas dengan dokter dan pertimbangkan uji alergi resmi (skin prick test / patch test).
          </p>
        </div>
      </div>

      {/* ── Trigger Detail Sheet ── */}
      {selectedTrigger && (
        <TriggerDetailSheet
          open={showTriggerDetail}
          score={selectedTrigger}
          allScores={analysisResult.itemScores}
          onClose={() => setShowTriggerDetail(false)}
        />
      )}
    </div>
  )
}

// ── Trigger Row ──
function TriggerRow({ score, rank, onTap }: { score: ItemWindowScore; rank: number; onTap: () => void }) {
  const confLabel = score.confidence
  const confClass =
    confLabel === 'Kemungkinan tinggi' ? 'conf-high' :
    confLabel === 'Kemungkinan sedang' ? 'conf-medium' :
    'conf-low'
  const confIcon =
    confLabel === 'Kemungkinan tinggi' ? '🔴' :
    confLabel === 'Kemungkinan sedang' ? '🟡' :
    '🟢'

  return (
    <button
      onClick={onTap}
      className="w-full text-left flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 transition-colors"
    >
      <span className="text-base font-bold text-muted-foreground w-6 shrink-0 text-center">#{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base font-semibold capitalize">{score.item}</span>
          <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium', confClass)}>
            {confIcon} {confLabel}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Dimakan {score.exposed}×, {score.followedByItch}× diikuti gatal dalam {score.window}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  )
}

// ── Trigger Detail Sheet ──
function TriggerDetailSheet({
  open, score, allScores, onClose,
}: {
  open: boolean
  score: ItemWindowScore
  allScores: ItemWindowScore[]
  onClose: () => void
}) {
  const [selectedWindow, setSelectedWindow] = useState<string>(score.window)

  const windowScore = allScores.find(s => s.item === score.item && s.window === selectedWindow) ?? score

  const windowLabels: Record<string, string> = {
    '0-2 jam': 'Langsung 0–2 jam',
    '2-6 jam': '2–6 jam',
    '6-24 jam': '6–24 jam',
    '24-48 jam': '1–2 hari',
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={score.item}>
      <div className="px-4 py-4 space-y-5">

        {/* Window selector */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Jendela waktu setelah makan</p>
          <div className="flex gap-2 flex-wrap">
            {TIME_WINDOWS.map(w => (
              <button
                key={w.label}
                onClick={() => setSelectedWindow(w.label)}
                className={cn(
                  'px-3 py-2 rounded-full text-sm font-medium border transition-all',
                  selectedWindow === w.label
                    ? 'bg-primary/20 border-primary/50 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/30'
                )}
              >
                {windowLabels[w.label] ?? w.label}
              </button>
            ))}
          </div>
        </div>

        {/* Numbers */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Dimakan', value: `${windowScore.exposed}×` },
            { label: 'Diikuti gatal', value: `${windowScore.followedByItch}× (${Math.round(windowScore.ratioItem * 100)}%)` },
            { label: 'Rata-rata parah', value: windowScore.followedByItch > 0 ? `${windowScore.avgSeverity.toFixed(1)}/10` : '–' },
            { label: 'Lift vs baseline', value: windowScore.lift.toFixed(2) + '×' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-secondary rounded-xl p-3">
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Lift {windowScore.lift.toFixed(2)}× artinya {score.item} {windowScore.lift > 1 ? 'lebih' : 'sama'} sering diikuti gatal dibanding rata-rata makanan lain dalam jendela {selectedWindow}.
          {windowScore.confidence === 'Data belum cukup' && ' Data masih kurang dari 3 kali makan.'}
        </p>
      </div>
    </BottomSheet>
  )
}
