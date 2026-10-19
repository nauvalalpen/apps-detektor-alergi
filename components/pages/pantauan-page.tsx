'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/badge'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine, Legend
} from 'recharts'
import { runAnalysis, getTopTriggers, isOralDepletionEpisode, type MedLogWithMed } from '@/lib/analysis'
import { formatShortDateWIB, getDateWIB, hoursSinceLastOralMed } from '@/lib/timezone'
import { cn, severityColor } from '@/lib/utils'
import { parseISO, differenceInDays, subDays, format } from 'date-fns'
import { Activity, TrendingDown, TrendingUp, Shield, AlertTriangle, Zap } from 'lucide-react'
import type { MealWithItems, ItchEvent, Medication, MedicationLog } from '@/lib/database.types'

interface PantauanPageProps {
  meals: MealWithItems[]
  itchEvents: ItchEvent[]
  medLogs: (MedicationLog & { medication: Medication })[]
  medications: Medication[]
  userId: string
}

export function PantauanPage({ meals, itchEvents, medLogs, medications, userId }: PantauanPageProps) {
  const [liveItch, setLiveItch] = useState(itchEvents)
  const [liveMedLogs, setLiveMedLogs] = useState(medLogs)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const supabase = createClient()

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase.channel(`pantauan-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'itch_events', filter: `user_id=eq.${userId}` },
        payload => {
          setLiveItch(prev => [...prev, payload.new as ItchEvent].sort((a, b) => a.started_at.localeCompare(b.started_at)))
          setLastUpdated(new Date())
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'medication_logs', filter: `user_id=eq.${userId}` },
        payload => {
          const newLog = payload.new as MedicationLog
          const med = medications.find(m => m.id === newLog.medication_id)
          if (med) {
            setLiveMedLogs(prev => [...prev, { ...newLog, medication: med }])
            setLastUpdated(new Date())
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, medications])

  const typedMedLogs = liveMedLogs as MedLogWithMed[]

  // Stats kalkulasi
  const now = new Date()
  const oneWeekAgo = subDays(now, 7)
  const twoWeeksAgo = subDays(now, 14)

  const thisWeekItch = liveItch.filter(e => parseISO(e.started_at) >= oneWeekAgo)
  const lastWeekItch = liveItch.filter(e => parseISO(e.started_at) >= twoWeeksAgo && parseISO(e.started_at) < oneWeekAgo)

  const thisWeekAvgSev = thisWeekItch.length > 0
    ? thisWeekItch.reduce((s, e) => s + (e.severity ?? 5), 0) / thisWeekItch.length : 0
  const lastWeekAvgSev = lastWeekItch.length > 0
    ? lastWeekItch.reduce((s, e) => s + (e.severity ?? 5), 0) / lastWeekItch.length : 0

  // Hari berturut tanpa gatal
  let consecutiveNoItch = 0
  for (let i = 0; i < 30; i++) {
    const d = format(subDays(now, i), 'yyyy-MM-dd')
    const hasItch = liveItch.some(e => getDateWIB(e.started_at) === d)
    if (hasItch) break
    consecutiveNoItch++
  }

  // Total hari data
  const allDates = [...new Set([
    ...meals.map(m => getDateWIB(m.eaten_at)),
    ...liveItch.map(e => getDateWIB(e.started_at)),
  ])]
  const totalDays = allDates.length

  // Grafik keparahan harian (30 hari)
  const dailyChartData = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const d = format(subDays(now, 29 - i), 'yyyy-MM-dd')
      const dayItch = liveItch.filter(e => getDateWIB(e.started_at) === d)
      const maxSev = dayItch.length > 0 ? Math.max(...dayItch.map(e => e.severity ?? 0)) : 0
      const avgSev = dayItch.length > 0 ? dayItch.reduce((s, e) => s + (e.severity ?? 0), 0) / dayItch.length : 0
      const medTaken = typedMedLogs.some(l => getDateWIB(l.taken_at) === d && l.medication.kind === 'oral')
      return {
        date: formatShortDateWIB(d + 'T12:00:00+07:00'),
        keparahan: maxSev || null,
        rataRata: avgSev > 0 ? Number(avgSev.toFixed(1)) : null,
        obat: medTaken ? 10 : null,
      }
    })
  }, [liveItch, typedMedLogs])

  // Histogram: jam sejak obat terakhir saat gatal
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
      const itchTime = parseISO(event.started_at)
      const hours = hoursSinceLastOralMed(itchTime, typedMedLogs)
      if (hours === null) return
      const bucket = buckets.find(b => hours >= b.min && hours < b.max)
      if (bucket) bucket.count++
    })

    return buckets
  }, [liveItch, typedMedLogs])

  // Top triggers
  const analysisResult = useMemo(() => {
    return runAnalysis({ meals, itchEvents: liveItch, medLogs: typedMedLogs })
  }, [meals, liveItch, typedMedLogs])

  const topTriggers = useMemo(() => getTopTriggers(analysisResult.itemScores, 5), [analysisResult])

  const itchTrend = thisWeekItch.length - lastWeekItch.length
  const sevTrend = thisWeekAvgSev - lastWeekAvgSev

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Pantauan</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Diperbarui otomatis · Live
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400">Realtime</span>
        </div>
      </div>

      {/* Progress bar data */}
      <Card className="border-primary/20">
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Data terkumpul: <strong>{totalDays}</strong> hari</span>
            <span className="text-muted-foreground">Target: 14 hari</span>
          </div>
          <Progress value={totalDays} max={14} color="auto" />
        </CardContent>
      </Card>

      {/* Kartu statistik */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-bold">{thisWeekItch.length}</p>
                <p className="text-xs text-muted-foreground">Gatal minggu ini</p>
              </div>
              <div className={cn(
                'flex items-center gap-0.5 text-xs font-medium',
                itchTrend < 0 ? 'text-emerald-400' : itchTrend > 0 ? 'text-red-400' : 'text-muted-foreground'
              )}>
                {itchTrend < 0 ? <TrendingDown className="w-3 h-3" /> : itchTrend > 0 ? <TrendingUp className="w-3 h-3" /> : null}
                {itchTrend !== 0 ? `${itchTrend > 0 ? '+' : ''}${itchTrend}` : '='}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Minggu lalu: {lastWeekItch.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className={cn('text-2xl font-bold', severityColor(Math.round(thisWeekAvgSev)))}>
                  {thisWeekAvgSev > 0 ? thisWeekAvgSev.toFixed(1) : '-'}
                </p>
                <p className="text-xs text-muted-foreground">Rata-rata keparahan</p>
              </div>
              <div className={cn(
                'text-xs font-medium',
                sevTrend < 0 ? 'text-emerald-400' : sevTrend > 0 ? 'text-red-400' : 'text-muted-foreground'
              )}>
                {sevTrend !== 0 ? `${sevTrend > 0 ? '+' : ''}${sevTrend.toFixed(1)}` : ''}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Minggu lalu: {lastWeekAvgSev > 0 ? lastWeekAvgSev.toFixed(1) : '-'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-emerald-400">{consecutiveNoItch}</p>
            <p className="text-xs text-muted-foreground">Hari berturut tanpa gatal</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-red-400">{analysisResult.depletionStats.depletionEpisodes}</p>
            <p className="text-xs text-muted-foreground">Episode saat obat habis</p>
          </CardContent>
        </Card>
      </div>

      {/* Kandidat pemicu */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Kandidat Pemicu Teratas
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {topTriggers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Data belum cukup untuk analisis.</p>
          ) : topTriggers.map((t, i) => (
            <div key={t.item} className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-4">#{i + 1}</span>
              <span className="font-medium capitalize flex-1">{t.item}</span>
              <Badge variant={
                t.confidence === 'Kemungkinan tinggi' ? 'danger' :
                t.confidence === 'Kemungkinan sedang' ? 'warning' :
                t.confidence === 'Kemungkinan rendah' ? 'success' : 'muted'
              }>{t.confidence}</Badge>
              <span className="text-xs text-muted-foreground">{t.followedByItch}/{t.exposed}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Kemungkinan aman */}
      {analysisResult.safeItems.length > 0 && (
        <Card className="border-emerald-800/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Shield className="w-4 h-4 text-emerald-400" />
              Kemungkinan Aman
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-1.5">
              {analysisResult.safeItems.map(item => (
                <Badge key={item.item} variant="success">{item.item} ({item.exposedCount}x)</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grafik keparahan harian */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Activity className="w-4 h-4 text-primary" />
            Keparahan Gatal 30 Hari
          </CardTitle>
          <CardDescription>Segitiga = obat oral diminum hari itu</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={dailyChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a27" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: '#6b9c78' }}
                interval={4}
              />
              <YAxis domain={[0, 10]} tick={{ fontSize: 9, fill: '#6b9c78' }} />
              <Tooltip
                contentStyle={{ background: '#122018', border: '1px solid #1e3a27', borderRadius: '12px', fontSize: '12px' }}
                labelStyle={{ color: '#e8f5e9' }}
              />
              <Line
                type="monotone"
                dataKey="keparahan"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3, fill: '#f59e0b' }}
                connectNulls={false}
                name="Maks. keparahan"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Histogram jam sejak obat terakhir */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-amber-400" />
            Gatal vs Jam Sejak Obat Terakhir
          </CardTitle>
          <CardDescription>
            Apakah gatal menumpuk saat obat sudah lama?
            {' '}Interval obat: {medications.find(m => m.kind === 'oral')?.interval_hours ?? 24} jam
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={depletionHistogram} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a27" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b9c78' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b9c78' }} />
              <Tooltip
                contentStyle={{ background: '#122018', border: '1px solid #1e3a27', borderRadius: '12px', fontSize: '12px' }}
              />
              <ReferenceLine x="24-30j" stroke="#ef4444" strokeDasharray="4 2" label={{ value: 'Habis', fill: '#ef4444', fontSize: 10 }} />
              <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Jumlah episode" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
