'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MealForm } from '@/components/forms/meal-form'
import { ItchForm } from '@/components/forms/itch-form'
import { MedForm } from '@/components/forms/med-form'
import { DailyContextForm } from '@/components/forms/daily-context-form'
import { showToast } from '@/components/ui/toaster'
import {
  formatTimeWIB, formatDateWIB, minutesDiff, getDateWIB, formatWIB
} from '@/lib/timezone'
import { cn, severityLabel, severityColor, severityBg, countCollectedDays, STRESS_EMOJIS } from '@/lib/utils'
import {
  UtensilsCrossed, Zap, Pill, AlertTriangle, CheckCircle2,
  Clock, ChevronRight, Info, Settings, Pencil, Trash2
} from 'lucide-react'
import type {
  MealWithItems, ItchEvent, Medication, MedicationLog, DailyContext
} from '@/lib/database.types'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

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

  // Form/sheet states
  const [showMealForm, setShowMealForm] = useState(false)
  const [showItchForm, setShowItchForm] = useState(false)
  const [showMedForm, setShowMedForm] = useState(false)
  const [showContextForm, setShowContextForm] = useState(false)

  // Edit states
  const [editMeal, setEditMeal] = useState<MealWithItems | null>(null)
  const [editItch, setEditItch] = useState<ItchEvent | null>(null)
  const [editMedLog, setEditMedLog] = useState<MedLogWithMed | null>(null)

  // Detail sheet
  const [detailItem, setDetailItem] = useState<TimelineItem | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  const supabase = createClient()

  // Fetch known items for autocomplete
  useEffect(() => {
    supabase
      .from('meal_items')
      .select('name')
      .eq('user_id', userId)
      .order('name')
      .then(({ data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (data) setKnownItems([...new Set((data as any[]).map((d: {name: string}) => d.name))])
      })
  }, [userId])

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

  // === Med status logic ===
  const oralMeds = medications.filter(m => m.kind === 'oral' && m.active)
  const medStatuses = oralMeds.map(med => {
    const lastLog = allMedLogs
      .filter(l => l.medication_id === med.id)
      .sort((a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime())[0]

    if (!lastLog) return { med, status: 'no-log' as const }

    const minSince = minutesDiff(lastLog.taken_at, new Date().toISOString())
    const hoursSince = minSince / 60
    const intervalMin = med.interval_hours * 60
    const remainingMin = intervalMin - minSince
    const isLate = minSince > (intervalMin + 60)
    const isSoon = !isLate && remainingMin <= 120

    // Compute "next dose" time
    const nextDoseTime = new Date(new Date(lastLog.taken_at).getTime() + med.interval_hours * 60 * 60 * 1000)

    return {
      med,
      lastLog,
      hoursSince: Math.floor(hoursSince),
      minSince,
      remainingMin: Math.round(remainingMin),
      nextDoseTime,
      isLate,
      isSoon,
      status: isLate ? 'late' as const : isSoon ? 'soon' as const : 'ok' as const,
    }
  })

  // Collected days (Bug #1 fix)
  const collectedDays = countCollectedDays(meals, itchEvents)

  // Build timeline
  type TimelineItem =
    | { type: 'meal'; time: string; data: MealWithItems }
    | { type: 'itch'; time: string; data: ItchEvent }
    | { type: 'med'; time: string; data: MedLogWithMed }

  const timeline: TimelineItem[] = [
    ...meals.map(m => ({ type: 'meal' as const, time: m.eaten_at, data: m })),
    ...itchEvents.map(e => ({ type: 'itch' as const, time: e.started_at, data: e })),
    ...medLogs.map(l => ({ type: 'med' as const, time: l.taken_at, data: l })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()) // newest on top

  async function deleteEntry(type: 'meal' | 'itch' | 'med', id: string) {
    const table = type === 'meal' ? 'meals' : type === 'itch' ? 'itch_events' : 'medication_logs'
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) {
      showToast({ title: 'Gagal menghapus, coba lagi', variant: 'destructive' })
      return
    }
    if (type === 'meal') setMeals(prev => prev.filter(m => m.id !== id))
    else if (type === 'itch') setItchEvents(prev => prev.filter(e => e.id !== id))
    else setMedLogs(prev => prev.filter(l => l.id !== id))
    setShowDetail(false)
    showToast({ title: 'Entri dihapus', variant: 'default' })
  }

  // Quick-log itch (1 tap)
  async function quickLogItch() {
    const now = new Date().toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('itch_events') as any)
      .insert({
        user_id: userId,
        started_at: now,
        severity: 5,
        body_areas: [],
        has_bumps: false,
        notes: null,
      })
      .select()
      .single()

    if (error) {
      showToast({ title: 'Gagal menyimpan, coba lagi', variant: 'destructive' })
      return
    }
    const saved = data as ItchEvent
    setItchEvents(prev => [...prev, saved].sort(
      (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
    ))
    showToast({
      title: `Gatal dicatat ${formatTimeWIB(now)}`,
      variant: 'success',
      duration: 8000,
      action: {
        label: 'Tambah detail',
        onClick: () => { setEditItch(saved); setShowItchForm(true) },
      },
    })
  }

  const todayLabel = formatDateWIB(today + 'T12:00:00+07:00')

  return (
    <div className="px-4 pt-4 pb-2 space-y-4 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Hari Ini</h1>
          <p className="text-sm text-muted-foreground capitalize mt-0.5">{todayLabel}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-muted-foreground">Data terkumpul</p>
          <p className="text-base font-bold text-primary">Hari ke-{collectedDays} dari 14</p>
        </div>
      </div>

      {/* ── Kartu Status Obat ── */}
      {oralMeds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-4 flex items-center gap-3">
          <Pill className="w-5 h-5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground">Tambahkan obat agar jadwal bisa dipantau</p>
          </div>
          <Link href="/pengaturan" className="shrink-0">
            <Button size="sm" variant="outline" className="text-xs h-8">
              + Tambah <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {medStatuses.map(status => {
            if (status.status === 'no-log') {
              return (
                <div key={status.med.id} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                    <Pill className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{status.med.name}</p>
                    <p className="text-sm text-muted-foreground">Belum ada catatan pemakaian</p>
                  </div>
                  <button
                    onClick={() => { setEditMedLog(null); setShowMedForm(true) }}
                    className="shrink-0 h-10 px-4 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-semibold hover:bg-blue-500/30 transition-all"
                  >
                    Catat
                  </button>
                </div>
              )
            }

            const { med, lastLog, isLate, isSoon, nextDoseTime, hoursSince } = status as typeof status & { lastLog: MedLogWithMed; nextDoseTime: Date; hoursSince: number }

            return (
              <div
                key={med.id}
                className={cn(
                  'rounded-2xl border p-4',
                  isLate ? 'border-red-800/60 bg-red-950/30' :
                  isSoon ? 'border-amber-800/50 bg-amber-950/20' :
                  'border-blue-800/40 bg-blue-950/15'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    isLate ? 'bg-red-500/20 border border-red-500/30' :
                    isSoon ? 'bg-amber-500/20 border border-amber-500/30' :
                    'bg-blue-500/20 border border-blue-500/30'
                  )}>
                    {isLate
                      ? <AlertTriangle className="w-5 h-5 text-red-400" />
                      : <Pill className="w-5 h-5 text-blue-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{med.name}</p>
                    {isLate ? (
                      <p className="text-sm text-red-400 mt-0.5">
                        Terlambat {hoursSince - med.interval_hours} jam · terakhir {formatWIB(lastLog!.taken_at, 'HH:mm')}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Terakhir diminum {hoursSince} jam lalu · berikutnya {formatWIB(nextDoseTime!, 'HH:mm')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => { setEditMedLog(null); setShowMedForm(true) }}
                    className={cn(
                      'shrink-0 h-10 px-4 rounded-xl text-sm font-semibold transition-all',
                      isLate
                        ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                        : 'bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30'
                    )}
                  >
                    Sudah diminum
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 3 Action Buttons ── */}
      <div className="grid grid-cols-3 gap-3">
        {/* + Makan */}
        <button
          id="btn-add-meal"
          onClick={() => { setEditMeal(null); setShowMealForm(true) }}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all active:scale-95 group"
          style={{ height: '88px' }}
          aria-label="Catat makan"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center group-hover:scale-105 transition-transform">
            <UtensilsCrossed className="w-6 h-6 text-primary" />
          </div>
          <span className="text-sm font-bold">+ Makan</span>
        </button>

        {/* + Gatal — 1 tap records immediately */}
        <button
          id="btn-add-itch"
          onClick={quickLogItch}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-950/15 hover:border-amber-500/60 hover:bg-amber-950/30 transition-all active:scale-95 group"
          style={{ height: '88px' }}
          aria-label="Catat gatal sekarang"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center group-hover:scale-105 transition-transform animate-pulse-green">
            <Zap className="w-6 h-6 text-amber-400" />
          </div>
          <span className="text-sm font-bold text-amber-300">+ Gatal</span>
        </button>

        {/* + Obat */}
        <button
          id="btn-add-med"
          onClick={() => { setEditMedLog(null); setShowMedForm(true) }}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-950/15 hover:border-blue-500/60 hover:bg-blue-950/30 transition-all active:scale-95 group"
          style={{ height: '88px' }}
          aria-label="Catat pemakaian obat"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Pill className="w-6 h-6 text-blue-400" />
          </div>
          <span className="text-sm font-bold text-blue-300">+ Obat</span>
        </button>
      </div>

      {/* ── Kartu Konteks Harian ── */}
      <button
        onClick={() => setShowContextForm(true)}
        className={cn(
          'w-full text-left px-4 py-3.5 rounded-2xl border transition-all hover:brightness-110 active:scale-[0.99]',
          dailyContext
            ? 'border-emerald-500/30 bg-emerald-950/15'
            : 'border-border bg-card hover:border-primary/30'
        )}
        aria-label={dailyContext ? 'Edit konteks harian' : 'Catat konteks harian'}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {dailyContext
              ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              : <Clock className="w-5 h-5 text-muted-foreground shrink-0" />
            }
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {dailyContext ? 'Konteks harian dicatat' : 'Catat konteks hari ini'}
              </p>
              {dailyContext ? (
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {STRESS_EMOJIS[dailyContext.stress ?? 3]} Stres {dailyContext.stress}/5
                  {dailyContext.sleep_hours != null ? ` · Tidur ${dailyContext.sleep_hours} jam` : ''}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-0.5">Stres, tidur, cuaca, produk baru</p>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </div>
      </button>

      {/* ── Timeline ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-muted-foreground">
            Timeline hari ini
            {timeline.length > 0 && (
              <span className="ml-2 text-xs bg-secondary px-2 py-0.5 rounded-full font-normal">
                {timeline.length}
              </span>
            )}
          </h2>
        </div>

        {timeline.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-3">
              <Clock className="w-8 h-8 opacity-50" />
            </div>
            <p className="font-medium text-foreground">Belum ada catatan hari ini</p>
            <p className="text-sm mt-1">Mulai dengan + Makan atau + Gatal di atas</p>
          </div>
        ) : (
          <div className="relative timeline-line space-y-2 pl-10">
            {timeline.map(item => (
              <TimelineCard
                key={`${item.type}-${item.data.id}`}
                item={item}
                onTap={() => { setDetailItem(item); setShowDetail(true) }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Forms (bottom sheets) ── */}
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

      {/* ── Detail bottom sheet ── */}
      {detailItem && (
        <EntryDetailSheet
          open={showDetail}
          item={detailItem}
          onClose={() => setShowDetail(false)}
          onEdit={() => {
            setShowDetail(false)
            if (detailItem.type === 'meal') {
              setEditMeal(detailItem.data as MealWithItems)
              setShowMealForm(true)
            } else if (detailItem.type === 'itch') {
              setEditItch(detailItem.data as ItchEvent)
              setShowItchForm(true)
            } else {
              setEditMedLog(detailItem.data as MedLogWithMed)
              setShowMedForm(true)
            }
          }}
          onDelete={() => deleteEntry(detailItem.type, detailItem.data.id)}
        />
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Timeline Card — tap to open detail, no edit/delete icons visible
// ──────────────────────────────────────────────────────────────
type TimelineItem =
  | { type: 'meal'; time: string; data: MealWithItems }
  | { type: 'itch'; time: string; data: ItchEvent }
  | { type: 'med'; time: string; data: MedLogWithMed }

function TimelineCard({
  item,
  onTap,
}: {
  item: TimelineItem
  onTap: () => void
}) {
  const config = {
    meal: { Icon: UtensilsCrossed, color: 'text-primary', bg: 'bg-primary/15 border-primary/25', dot: 'bg-primary' },
    itch: { Icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/25', dot: 'bg-amber-400' },
    med: { Icon: Pill, color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/25', dot: 'bg-blue-400' },
  }[item.type]

  return (
    <div className="relative">
      {/* Timeline dot */}
      <div className={cn(
        'absolute -left-[2.4rem] top-4 w-3 h-3 rounded-full border-2 border-background',
        config.dot
      )} />

      <button
        onClick={onTap}
        className="w-full text-left rounded-2xl border border-border bg-card p-4 hover:border-primary/30 hover:bg-primary/5 transition-all active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center shrink-0', config.bg)}>
            <config.Icon className={cn('w-5 h-5', config.color)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Time */}
            <p className="text-base font-semibold text-muted-foreground leading-none mb-1">
              {formatTimeWIB(item.time)}
            </p>
            {/* Main label */}
            {item.type === 'meal' && (
              <p className="text-base font-medium truncate">
                {(item.data as MealWithItems).meal_items.map((i: {id: string; name: string; meal_id: string; user_id: string; created_at: string}) => i.name).join(', ') || 'Makan'}
              </p>
            )}
            {item.type === 'itch' && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-base font-bold', severityColor((item.data as ItchEvent).severity ?? 5))}>
                  {severityLabel((item.data as ItchEvent).severity ?? 5)} {(item.data as ItchEvent).severity}/10
                </span>
                {(item.data as ItchEvent).body_areas?.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    · {(item.data as ItchEvent).body_areas.slice(0, 2).join(', ')}
                  </span>
                )}
              </div>
            )}
            {item.type === 'med' && (
              <p className="text-base font-medium text-blue-300">
                {(item.data as MedLogWithMed).medication.name}
                <span className="text-sm text-muted-foreground ml-2">
                  {(item.data as MedLogWithMed).medication.kind === 'oral' ? 'Oral' : 'Salep'}
                </span>
              </p>
            )}
          </div>

          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </div>
      </button>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Entry Detail Bottom Sheet
// ──────────────────────────────────────────────────────────────
function EntryDetailSheet({
  open, item, onClose, onEdit, onDelete,
}: {
  open: boolean
  item: TimelineItem
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  function handleDelete() {
    if (!confirming) { setConfirming(true); return }
    onDelete()
    setConfirming(false)
  }

  const typeLabel = { meal: 'Makan', itch: 'Episode Gatal', med: 'Obat' }[item.type]

  return (
    <BottomSheet open={open} onClose={onClose} title={typeLabel}>
      <div className="px-4 pt-2 pb-4 space-y-4">
        {/* Time */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="text-sm">{formatWIB(item.time)}</span>
        </div>

        {/* Details */}
        {item.type === 'meal' && (() => {
          const m = item.data as MealWithItems
          return (
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1.5">Item makanan</p>
                <div className="flex flex-wrap gap-1.5">
                  {m.meal_items.map(i => (
                    <span key={i.id} className="px-3 py-1.5 bg-primary/15 border border-primary/25 rounded-full text-sm font-medium text-primary">
                      {i.name}
                    </span>
                  ))}
                </div>
              </div>
              {m.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Catatan</p>
                  <p className="text-sm">{m.notes}</p>
                </div>
              )}
            </div>
          )
        })()}

        {item.type === 'itch' && (() => {
          const e = item.data as ItchEvent
          const sevClass = e.severity && e.severity <= 4 ? 'sev-mild' : e.severity && e.severity <= 6 ? 'sev-medium' : 'sev-severe'
          return (
            <div className="space-y-3">
              <div className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold', sevClass)}>
                <Zap className="w-4 h-4" />
                {severityLabel(e.severity ?? 5)} — {e.severity}/10
              </div>
              {e.body_areas?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1.5">Area tubuh</p>
                  <div className="flex flex-wrap gap-1.5">
                    {e.body_areas.map(a => (
                      <span key={a} className="px-3 py-1.5 bg-amber-500/15 border border-amber-500/25 rounded-full text-sm text-amber-300">{a}</span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-sm">
                <span className="text-muted-foreground">Bentol: </span>
                <span className="font-medium">{e.has_bumps ? 'Ada' : 'Tidak ada'}</span>
              </p>
              {e.notes && (
                <p className="text-sm"><span className="text-muted-foreground">Catatan: </span>{e.notes}</p>
              )}
            </div>
          )
        })()}

        {item.type === 'med' && (() => {
          const l = item.data as MedLogWithMed
          return (
            <div className="space-y-2">
              <p className="text-base font-semibold">{l.medication.name}</p>
              <p className="text-sm text-muted-foreground">
                {l.medication.kind === 'oral' ? '💊 Obat minum' : '🧴 Salep / topikal'}
                {l.medication.kind === 'oral' ? ` · Interval ${l.medication.interval_hours} jam` : ''}
              </p>
              {l.notes && <p className="text-sm"><span className="text-muted-foreground">Catatan: </span>{l.notes}</p>}
            </div>
          )
        })()}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1 h-12"
            onClick={onEdit}
          >
            <Pencil className="w-4 h-4 mr-2" /> Edit
          </Button>
          <Button
            variant="destructive"
            className="flex-1 h-12"
            onClick={handleDelete}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {confirming ? 'Konfirmasi hapus?' : 'Hapus'}
          </Button>
        </div>
        {confirming && (
          <p className="text-center text-xs text-muted-foreground -mt-2">Tap "Konfirmasi hapus?" sekali lagi untuk hapus</p>
        )}
      </div>
    </BottomSheet>
  )
}
