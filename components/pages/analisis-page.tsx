'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  runAnalysis, getTopTriggers, TIME_WINDOWS, isOralDepletionEpisode,
  type AnalysisInput, type ItemWindowScore, type MedLogWithMed
} from '@/lib/analysis'
import type { MealWithItems, ItchEvent, Medication, MedicationLog } from '@/lib/database.types'
import {
  AlertTriangle, CheckCircle2, Info, TrendingUp, Shield, FlaskConical,
  ToggleLeft, ToggleRight, ChevronDown, ChevronUp
} from 'lucide-react'
import { parseISO } from 'date-fns'

interface AnalisisPageProps {
  meals: MealWithItems[]
  itchEvents: ItchEvent[]
  medLogs: (MedicationLog & { medication: Medication })[]
  medications: Medication[]
}

export function AnalisisPage({ meals, itchEvents, medLogs, medications }: AnalisisPageProps) {
  const [includeDepletion, setIncludeDepletion] = useState(false)
  const [selectedWindow, setSelectedWindow] = useState('2-6 jam')
  const [showAll, setShowAll] = useState(false)

  const typedMedLogs = medLogs as MedLogWithMed[]

  const result = useMemo(() => {
    const input: AnalysisInput = {
      meals,
      itchEvents,
      medLogs: typedMedLogs,
      includeOralDepletionEpisodes: includeDepletion,
    }
    return runAnalysis(input)
  }, [meals, itchEvents, typedMedLogs, includeDepletion])

  const topTriggers = useMemo(() => getTopTriggers(result.itemScores, 5), [result])

  const windowScores = useMemo(
    () => result.itemScores.filter(s => s.window === selectedWindow).slice(0, showAll ? 999 : 10),
    [result, selectedWindow, showAll]
  )

  const totalDays = result.totalDays
  const progressDays = Math.min(14, totalDays)

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Analisis Pemicu</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Indikasi dari data pribadi — bukan diagnosis medis
        </p>
      </div>

      {/* Progress data */}
      <Card className="border-primary/20">
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Data terkumpul: <strong>{totalDays}</strong> hari dari target 14 hari</span>
            <span className="text-muted-foreground">{result.totalItchEpisodes} episode gatal</span>
          </div>
          <Progress value={progressDays} max={14} color="auto" showLabel />
          {totalDays < 7 && (
            <p className="text-xs text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Data masih kurang dari 7 hari. Analisis belum representatif.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Statistik obat habis */}
      <Card className={cn(
        'border',
        result.depletionStats.depletionRatio > 0.3 ? 'border-red-800/50 bg-red-950/20' : 'border-border'
      )}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className={cn('w-4 h-4', result.depletionStats.depletionRatio > 0.3 ? 'text-red-400' : 'text-amber-400')} />
            Konfounder: Efek Obat Habis
          </CardTitle>
          <CardDescription>
            Episode gatal saat obat sudah melewati interval — tidak dihitung ke analisis makanan secara default
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-secondary/50 rounded-xl p-3">
              <p className="text-xl font-bold">{result.depletionStats.totalItchEpisodes}</p>
              <p className="text-xs text-muted-foreground">Total episode</p>
            </div>
            <div className="bg-red-950/30 rounded-xl p-3">
              <p className="text-xl font-bold text-red-400">{result.depletionStats.depletionEpisodes}</p>
              <p className="text-xs text-muted-foreground">Saat obat habis</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-3">
              <p className="text-xl font-bold text-primary">{result.depletionStats.totalItchEpisodes - result.depletionStats.depletionEpisodes}</p>
              <p className="text-xs text-muted-foreground">Valid (dianalisis)</p>
            </div>
          </div>

          <div className="flex items-center justify-between bg-secondary/30 rounded-xl px-3 py-2">
            <span className="text-sm">Sertakan episode efek obat habis</span>
            <button onClick={() => setIncludeDepletion(!includeDepletion)}>
              {includeDepletion
                ? <ToggleRight className="w-6 h-6 text-primary" />
                : <ToggleLeft className="w-6 h-6 text-muted-foreground" />
              }
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Top 5 kandidat pemicu */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-red-400" />
            Top Kandidat Pemicu
          </CardTitle>
          <CardDescription>Berdasarkan lift score tertinggi (semua window waktu)</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {topTriggers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Belum ada data cukup. Tambah lebih banyak entri makan dan gatal.
            </p>
          ) : (
            topTriggers.map((score, idx) => (
              <TriggerCard key={`${score.item}-${score.window}`} score={score} rank={idx + 1} />
            ))
          )}
        </CardContent>
      </Card>

      {/* Filter per window */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-primary" />
            Analisis per Jendela Waktu
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {TIME_WINDOWS.map(w => (
              <button
                key={w.label}
                onClick={() => setSelectedWindow(w.label)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-medium border transition-all',
                  selectedWindow === w.label
                    ? 'bg-primary/20 border-primary/40 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/30'
                )}
              >
                {w.label}
              </button>
            ))}
          </div>

          {windowScores.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Belum ada item yang dimakan dan diikuti gatal di window ini.
            </p>
          ) : (
            <div className="space-y-2">
              {windowScores.map(score => (
                <TriggerCard key={`${score.item}-${score.window}`} score={score} compact />
              ))}
              {result.itemScores.filter(s => s.window === selectedWindow).length > 10 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                  {showAll ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${result.itemScores.filter(s => s.window === selectedWindow).length})`}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kemungkinan aman */}
      {result.safeItems.length > 0 && (
        <Card className="border-emerald-800/30 bg-emerald-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Kemungkinan Aman
            </CardTitle>
            <CardDescription>
              Dimakan ≥3x tanpa diikuti gatal dalam 48 jam. Bukan jaminan — bisa berubah dengan data lebih banyak.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {result.safeItems.map(item => (
                <div key={item.item} className="flex items-center gap-1 bg-emerald-950/30 border border-emerald-800/40 rounded-xl px-2.5 py-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span className="text-sm text-emerald-300">{item.item}</span>
                  <span className="text-xs text-muted-foreground">({item.exposedCount}x)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <Card className="border-amber-800/30 bg-amber-950/10">
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300/80 leading-relaxed">
              Semua hasil adalah <strong>indikasi dari data pribadi, bukan diagnosis medis</strong>.
              Angka lift dan rasio mencerminkan korelasi, bukan sebab-akibat.
              Bahas hasil ini dengan dokter Anda dan pertimbangkan uji alergi resmi (skin prick test / patch test).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function TriggerCard({ score, rank, compact }: { score: ItemWindowScore; rank?: number; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false)

  const confidenceVariant = {
    'Data belum cukup': 'muted' as const,
    'Kemungkinan rendah': 'success' as const,
    'Kemungkinan sedang': 'warning' as const,
    'Kemungkinan tinggi': 'danger' as const,
  }[score.confidence] ?? 'muted'

  const liftPct = Math.min(100, ((score.lift - 1) / 4) * 100)

  return (
    <div
      className={cn(
        'rounded-xl border transition-all',
        score.confidence === 'Kemungkinan tinggi' ? 'border-red-800/40 bg-red-950/10' :
        score.confidence === 'Kemungkinan sedang' ? 'border-amber-800/30 bg-amber-950/10' :
        'border-border bg-card'
      )}
    >
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={() => !compact && setExpanded(!expanded)}
      >
        {rank && (
          <span className="text-lg font-bold text-muted-foreground w-6 text-center">#{rank}</span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold capitalize">{score.item}</span>
            <Badge variant={confidenceVariant}>{score.confidence}</Badge>
            {!compact && <Badge variant="muted">{score.window}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dimakan {score.exposed}x · Diikuti gatal {score.followedByItch}x ({Math.round(score.ratioItem * 100)}%) · Lift: {score.lift.toFixed(2)}x
          </p>
          {!compact && (
            <div className="mt-2">
              <Progress value={liftPct} color={liftPct > 60 ? 'red' : liftPct > 30 ? 'yellow' : 'green'} />
            </div>
          )}
        </div>
        {!compact && (
          expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {expanded && !compact && (
        <div className="px-3 pb-3 border-t border-border/50 pt-2 space-y-1.5 text-xs text-muted-foreground">
          <p>• Dimakan: <span className="text-foreground font-medium">{score.exposed}x</span></p>
          <p>• Diikuti gatal ({score.window}): <span className="text-foreground font-medium">{score.followedByItch}x ({Math.round(score.ratioItem * 100)}%)</span></p>
          <p>• Rasio baseline (semua makanan): <span className="text-foreground font-medium">{Math.round(score.ratioBaseline * 100)}%</span></p>
          <p>• Lift: <span className="text-foreground font-medium">{score.lift.toFixed(2)}x</span> (baseline = 1.0)</p>
          <p>• Rata-rata keparahan gatal: <span className="text-foreground font-medium">{score.avgSeverity.toFixed(1)}/10</span></p>
          <p className="text-amber-400/70 mt-1">Lift &gt; 1 artinya item ini lebih sering diikuti gatal dibanding rata-rata makanan lain.</p>
        </div>
      )}
    </div>
  )
}
