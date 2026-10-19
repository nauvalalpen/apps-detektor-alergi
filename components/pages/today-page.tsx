'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MealForm } from '@/components/forms/meal-form'
import { ItchForm } from '@/components/forms/itch-form'
import { MedForm } from '@/components/forms/med-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { showToast } from '@/components/ui/toaster'
import {
  formatWIB, formatTimeWIB, formatDateWIB, minutesDiff, formatDuration, getDateWIB, severityLabel
} from '@/lib/timezone'
import { cn, severityColor } from '@/lib/utils'
import {
  UtensilsCrossed, Zap, Pill, Pencil, Trash2, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Clock
} from 'lucide-react'
import type {
  MealWithItems, ItchEvent, Medication, MedicationLog, DailyContext
} from '@/lib/database.types'
import { DailyContextForm } from '@/components/forms/daily-context-form'

interface MedLogWithMed extends MedicationLog { medication: Medication }

interface TodayPageProps {
  initialMeals: MealWithItems[]
  initialItchEvents: ItchEvent[]
  initialMedLogs: MedLogWithMed[]
  medications: Medication[]
  dailyContext: DailyContext | null
  allMedLogs: MedLogWithMed[]
  today: string
  userId: string
}

export function TodayPage({
  initialMeals,
  initialItchEvents,
  initialMedLogs,
  medications,
  dailyContext: initialDailyContext,
  allMedLogs: initialAllMedLogs,
  today,
  userId,
}: TodayPageProps) {
  const [meals, setMeals] = useState(initialMeals)
  const [itchEvents, setItchEvents] = useState(initialItchEvents)
  const [medLogs, setMedLogs] = useState(initialMedLogs)
  const [allMedLogs, setAllMedLogs] = useState(initialAllMedLogs)
  const [dailyContext, setDailyContext] = useState(initialDailyContext)
  const [knownItems, setKnownItems] = useState<string[]>([])

  const [showMealForm, setShowMealForm] = useState(false)
  const [showItchForm, setShowItchForm] = useState(false)
  const [showMedForm, setShowMedForm] = useState(false)
  const [showContextForm, setShowContextForm] = useState(false)

  const [editMeal, setEditMeal] = useState<MealWithItems | null>(null)
  const [editItch, setEditItch] = useState<ItchEvent | null>(null)
  const [editMedLog, setEditMedLog] = useState<MedLogWithMed | null>(null)

  const supabase = createClient()

  // Fetch known items for autocomplete
  useEffect(() => {
    supabase
      .from('meal_items')
      .select('name')
      .eq('user_id', userId)
      .order('name')
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map(d => d.name))]
          setKnownItems(unique)
        }
      })
  }, [userId])

  // Hitung warning obat telat
  const oralMeds = medications.filter(m => m.kind === 'oral')
  const oralMedWarnings = oralMeds.map(med => {
    const lastLog = allMedLogs
      .filter(l => l.medication_id === med.id)
      .sort((a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime())[0]

    if (!lastLog) return null
    const hoursSince = Math.abs(minutesDiff(lastLog.taken_at, new Date().toISOString())) / 60
    const isLate = hoursSince > (med.interval_hours + 1)
    if (!isLate) return null
    return {
      med,
      hoursSince: Math.floor(hoursSince),
      lastTaken: lastLog.taken_at,
    }
  }).filter(Boolean)

  // Build timeline
  type TimelineItem =
    | { type: 'meal'; time: string; data: MealWithItems }
    | { type: 'itch'; time: string; data: ItchEvent }
    | { type: 'med'; time: string; data: MedLogWithMed }

  const timeline: TimelineItem[] = [
    ...meals.map(m => ({ type: 'meal' as const, time: m.eaten_at, data: m })),
    ...itchEvents.map(e => ({ type: 'itch' as const, time: e.started_at, data: e })),
    ...medLogs.map(l => ({ type: 'med' as const, time: l.taken_at, data: l })),
  ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

  async function deleteEntry(type: 'meal' | 'itch' | 'med', id: string) {
    const table = type === 'meal' ? 'meals' : type === 'itch' ? 'itch_events' : 'medication_logs'
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) {
      showToast({ title: 'Gagal menghapus', variant: 'destructive' })
      return
    }
    if (type === 'meal') setMeals(prev => prev.filter(m => m.id !== id))
    else if (type === 'itch') setItchEvents(prev => prev.filter(e => e.id !== id))
    else setMedLogs(prev => prev.filter(l => l.id !== id))
    showToast({ title: 'Entri dihapus', variant: 'default' })
  }

  // Realtime subscription
  useEffect(() => {
    const channel = supabase.channel(`today-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'meals',
        filter: `user_id=eq.${userId}`
      }, payload => {
        const newMeal = payload.new as MealWithItems
        if (getDateWIB(newMeal.eaten_at) === today) {
          setMeals(prev => [...prev, { ...newMeal, meal_items: [] }].sort(
            (a, b) => new Date(a.eaten_at).getTime() - new Date(b.eaten_at).getTime()
          ))
        }
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'itch_events',
        filter: `user_id=eq.${userId}`
      }, payload => {
        const newEvent = payload.new as ItchEvent
        if (getDateWIB(newEvent.started_at) === today) {
          setItchEvents(prev => [...prev, newEvent].sort(
            (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
          ))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, today])

  const todayLabel = formatDateWIB(today + 'T12:00:00+07:00')

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Hari Ini</h1>
          <p className="text-sm text-muted-foreground capitalize">{todayLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Target 14 hari</p>
          <p className="text-sm font-medium text-primary">
            {Math.min(14, allMedLogs.length > 0 ? 1 : 0)}/14 hari
          </p>
        </div>
      </div>

      {/* Peringatan obat telat */}
      {oralMedWarnings.length > 0 && oralMedWarnings.map((w, i) => w && (
        <div key={i} className="bg-red-950/50 border border-red-800/60 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-300">
              ⚠️ {w.med.name} sudah {w.hoursSince} jam terakhir diminum!
            </p>
            <p className="text-xs text-red-400/80 mt-0.5">
              Terakhir: {formatWIB(w.lastTaken)} · Interval: {w.med.interval_hours} jam
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => { setSelectedMedForQuick(w.med.id); setShowMedForm(true) }}
            variant="destructive"
          >
            Catat
          </Button>
        </div>
      ))}

      {/* 3 tombol utama */}
      <div className="grid grid-cols-3 gap-3">
        <button
          id="btn-add-meal"
          onClick={() => { setEditMeal(null); setShowMealForm(true) }}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all active:scale-95 group"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center group-hover:scale-110 transition-transform">
            <UtensilsCrossed className="w-6 h-6 text-primary" />
          </div>
          <span className="text-sm font-semibold">+ Makan</span>
        </button>

        <button
          id="btn-add-itch"
          onClick={() => { setEditItch(null); setShowItchForm(true) }}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-amber-500/30 bg-amber-950/20 hover:border-amber-500/60 hover:bg-amber-950/40 transition-all active:scale-95 group"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center group-hover:scale-110 transition-transform animate-pulse-green">
            <Zap className="w-6 h-6 text-amber-400" />
          </div>
          <span className="text-sm font-semibold text-amber-300">+ Gatal</span>
        </button>

        <button
          id="btn-add-med"
          onClick={() => { setEditMedLog(null); setShowMedForm(true) }}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 hover:border-cyan-500/60 hover:bg-cyan-950/40 transition-all active:scale-95 group"
        >
          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Pill className="w-6 h-6 text-cyan-400" />
          </div>
          <span className="text-sm font-semibold text-cyan-300">+ Obat</span>
        </button>
      </div>

      {/* Konteks harian */}
      <button
        onClick={() => setShowContextForm(true)}
        className={cn(
          'w-full text-left px-4 py-3 rounded-2xl border transition-all',
          dailyContext
            ? 'border-emerald-500/30 bg-emerald-950/20'
            : 'border-border bg-card hover:border-primary/30'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {dailyContext ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Clock className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">
              {dailyContext ? 'Konteks harian dicatat' : 'Catat konteks hari ini'}
            </span>
          </div>
          {dailyContext && (
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span>Stres: {dailyContext.stress}/5</span>
              <span>·</span>
              <span>Tidur: {dailyContext.sleep_hours} jam</span>
            </div>
          )}
        </div>
      </button>

      {/* Timeline hari ini */}
      <div>
        <h2 className="text-base font-semibold mb-3 text-muted-foreground">
          Timeline Hari Ini
          {timeline.length > 0 && (
            <span className="ml-2 text-xs bg-secondary px-2 py-0.5 rounded-full">
              {timeline.length} entri
            </span>
          )}
        </h2>

        {timeline.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-3">
              <Clock className="w-8 h-8" />
            </div>
            <p className="font-medium">Belum ada catatan hari ini</p>
            <p className="text-sm mt-1">Tap tombol di atas untuk mulai mencatat</p>
          </div>
        ) : (
          <div className="relative timeline-line space-y-2 pl-10">
            {timeline.map((item, idx) => (
              <TimelineCard
                key={`${item.type}-${item.data.id}`}
                item={item}
                onEdit={() => {
                  if (item.type === 'meal') { setEditMeal(item.data as MealWithItems); setShowMealForm(true) }
                  else if (item.type === 'itch') { setEditItch(item.data as ItchEvent); setShowItchForm(true) }
                  else { setEditMedLog(item.data as MedLogWithMed); setShowMedForm(true) }
                }}
                onDelete={() => deleteEntry(item.type, item.data.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Forms */}
      <MealForm
        open={showMealForm}
        onClose={() => { setShowMealForm(false); setEditMeal(null) }}
        userId={userId}
        editData={editMeal}
        onSave={meal => {
          if (editMeal) {
            setMeals(prev => prev.map(m => m.id === meal.id ? meal : m))
          } else {
            setMeals(prev => [...prev, meal].sort(
              (a, b) => new Date(a.eaten_at).getTime() - new Date(b.eaten_at).getTime()
            ))
            setKnownItems(prev => [...new Set([...prev, ...meal.meal_items.map(i => i.name)])])
          }
        }}
        knownItems={knownItems}
      />

      <ItchForm
        open={showItchForm}
        onClose={() => { setShowItchForm(false); setEditItch(null) }}
        userId={userId}
        editData={editItch}
        onSave={event => {
          if (editItch) {
            setItchEvents(prev => prev.map(e => e.id === event.id ? event : e))
          } else {
            setItchEvents(prev => [...prev, event].sort(
              (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
            ))
          }
        }}
      />

      <MedForm
        open={showMedForm}
        onClose={() => { setShowMedForm(false); setEditMedLog(null) }}
        userId={userId}
        medications={medications}
        editData={editMedLog}
        onSave={log => {
          if (editMedLog) {
            setMedLogs(prev => prev.map(l => l.id === log.id ? log : l))
          } else {
            setMedLogs(prev => [...prev, log].sort(
              (a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime()
            ))
            setAllMedLogs(prev => [...prev, log])
          }
        }}
      />

      <DailyContextForm
        open={showContextForm}
        onClose={() => setShowContextForm(false)}
        userId={userId}
        date={today}
        editData={dailyContext}
        onSave={ctx => setDailyContext(ctx)}
      />
    </div>
  )
}

// Helper: state untuk quick-select med (workaround untuk warning button)
let selectedMedForQuick = ''
function setSelectedMedForQuick(id: string) { selectedMedForQuick = id }

// Timeline Card
function TimelineCard({
  item,
  onEdit,
  onDelete,
}: {
  item: { type: 'meal' | 'itch' | 'med'; time: string; data: MealWithItems | ItchEvent | (MedicationLog & { medication: Medication }) }
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const iconMap = {
    meal: { icon: UtensilsCrossed, color: 'text-primary', bg: 'bg-primary/20 border-primary/30', dot: 'bg-primary' },
    itch: { icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30', dot: 'bg-amber-400' },
    med: { icon: Pill, color: 'text-cyan-400', bg: 'bg-cyan-500/20 border-cyan-500/30', dot: 'bg-cyan-400' },
  }

  const config = iconMap[item.type]
  const Icon = config.icon

  return (
    <div className="relative">
      {/* Dot on timeline */}
      <div className={cn(
        'absolute -left-[2.35rem] top-3 w-3 h-3 rounded-full border-2 border-background',
        config.dot
      )} />

      <Card className="overflow-hidden">
        <div
          className="flex items-center gap-3 p-3 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className={cn('w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0', config.bg)}>
            <Icon className={cn('w-4 h-4', config.color)} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono">
                {formatTimeWIB(item.time)}
              </span>
              {item.type === 'itch' && (
                <span className={cn('text-xs font-bold', severityColor((item.data as ItchEvent).severity ?? 5))}>
                  Parah: {(item.data as ItchEvent).severity}/10
                </span>
              )}
            </div>

            {item.type === 'meal' && (
              <p className="text-sm font-medium truncate">
                {(item.data as MealWithItems).meal_items.map(i => i.name).join(', ') || 'Makan'}
              </p>
            )}
            {item.type === 'itch' && (
              <p className="text-sm font-medium text-amber-300">
                Episode Gatal – {severityLabel((item.data as ItchEvent).severity ?? 5)}
              </p>
            )}
            {item.type === 'med' && (
              <p className="text-sm font-medium text-cyan-300">
                {(item.data as MedLogWithMed).medication.name}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={e => { e.stopPropagation(); onEdit() }}
              className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={e => {
                e.stopPropagation()
                if (window.confirm('Hapus entri ini?')) {
                  setDeleting(true)
                  onDelete()
                }
              }}
              className="p-1.5 rounded-lg hover:bg-red-950/50 text-muted-foreground hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {expanded && (
          <div className="px-3 pb-3 border-t border-border/50 pt-2 text-sm text-muted-foreground space-y-1.5">
            {item.type === 'meal' && (
              <>
                <p>
                  <span className="text-foreground font-medium">Item: </span>
                  {(item.data as MealWithItems).meal_items.map(i => i.name).join(' · ')}
                </p>
                {(item.data as MealWithItems).notes && (
                  <p>
                    <span className="text-foreground font-medium">Catatan: </span>
                    {(item.data as MealWithItems).notes}
                  </p>
                )}
              </>
            )}
            {item.type === 'itch' && (
              <>
                {(item.data as ItchEvent).body_areas?.length > 0 && (
                  <p>
                    <span className="text-foreground font-medium">Area: </span>
                    {(item.data as ItchEvent).body_areas.join(', ')}
                  </p>
                )}
                <p>
                  <span className="text-foreground font-medium">Bentol: </span>
                  {(item.data as ItchEvent).has_bumps ? 'Ya' : 'Tidak'}
                </p>
                {(item.data as ItchEvent).notes && (
                  <p>
                    <span className="text-foreground font-medium">Catatan: </span>
                    {(item.data as ItchEvent).notes}
                  </p>
                )}
              </>
            )}
            {item.type === 'med' && (
              <>
                <p>
                  <span className="text-foreground font-medium">Jenis: </span>
                  {(item.data as MedLogWithMed).medication.kind === 'oral' ? 'Obat Minum' : 'Salep Topikal'}
                </p>
                {(item.data as MedLogWithMed).notes && (
                  <p>
                    <span className="text-foreground font-medium">Catatan: </span>
                    {(item.data as MedLogWithMed).notes}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
