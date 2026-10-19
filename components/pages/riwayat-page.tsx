'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { addDays, subDays, format, parseISO, eachDayOfInterval, startOfMonth, endOfMonth, getDate } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar, List, UtensilsCrossed, Zap, Pill, SunMedium, LayoutGrid } from 'lucide-react'
import { formatWIB, formatTimeWIB, formatDateWIB, getDateWIB, minutesDiff, formatDuration } from '@/lib/timezone'
import { cn, severityColor, severityLabel, calendarDayColor, countCollectedDays, STRESS_EMOJIS } from '@/lib/utils'
import { isOralDepletionEpisode } from '@/lib/analysis'
import type { MealWithItems, ItchEvent, Medication, MedicationLog, DailyContext } from '@/lib/database.types'

interface MedLogWithMed extends MedicationLog { medication: Medication }

interface RiwayatPageProps {
  meals: MealWithItems[]
  itchEvents: ItchEvent[]
  medLogs: MedLogWithMed[]
  medications: Medication[]
  dailyContexts: DailyContext[]
  today: string
  userId: string
}

type ViewMode = 'calendar' | 'list'

export function RiwayatPage({ meals, itchEvents, medLogs, medications, dailyContexts, today }: RiwayatPageProps) {
  const [selectedDate, setSelectedDate] = useState(today)
  const [viewMonth, setViewMonth] = useState(() => today.slice(0, 7))
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const detailRef = useRef<HTMLDivElement>(null)

  // Group by date
  const mealsByDate = useMemo(() => {
    const map = new Map<string, MealWithItems[]>()
    meals.forEach(m => {
      const d = getDateWIB(m.eaten_at)
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(m)
    })
    return map
  }, [meals])

  const itchByDate = useMemo(() => {
    const map = new Map<string, ItchEvent[]>()
    itchEvents.forEach(e => {
      const d = getDateWIB(e.started_at)
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(e)
    })
    return map
  }, [itchEvents])

  const medByDate = useMemo(() => {
    const map = new Map<string, MedLogWithMed[]>()
    medLogs.forEach(l => {
      const d = getDateWIB(l.taken_at)
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(l)
    })
    return map
  }, [medLogs])

  const contextByDate = useMemo(() => {
    const map = new Map<string, DailyContext>()
    dailyContexts.forEach(c => map.set(c.date, c))
    return map
  }, [dailyContexts])

  // Selected day data
  const dayMeals = mealsByDate.get(selectedDate) ?? []
  const dayItch = itchByDate.get(selectedDate) ?? []
  const dayMeds = medByDate.get(selectedDate) ?? []
  const dayContext = contextByDate.get(selectedDate) ?? null

  // Auto-scroll to detail when selecting a date
  useEffect(() => {
    if (detailRef.current) {
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [selectedDate])

  // ── Natural language summary (Bug #2 fix) ──
  const autoSummary = useMemo(() => {
    if (dayMeals.length === 0 && dayItch.length === 0) return 'Tidak ada catatan untuk hari ini.'
    const parts: string[] = []

    const mealCount = dayMeals.length
    const itchCount = dayItch.length

    if (mealCount > 0) parts.push(`makan ${mealCount} kali`)
    if (itchCount > 0) {
      const maxSev = Math.max(...dayItch.map(e => e.severity ?? 0))
      const maxEvent = dayItch.find(e => e.severity === maxSev)
      // Bug #2 fix: "terparah X/10 pukul HH.mm" instead of "puncak keparahan X jam HH:MM"
      const maxStr = maxEvent ? `terparah ${maxSev}/10 pukul ${formatTimeWIB(maxEvent.started_at).replace(':', '.')}` : `terparah ${maxSev}/10`
      parts.push(`gatal ${itchCount} kali (${maxStr})`)
    } else if (mealCount > 0) {
      parts.push('tidak ada gatal')
    }

    // Check proximity
    const proximityNotes: string[] = []
    dayItch.forEach(itch => {
      const itchTime = parseISO(itch.started_at)
      dayMeals.forEach(meal => {
        const mealTime = parseISO(meal.eaten_at)
        const diffMin = Math.round((itchTime.getTime() - mealTime.getTime()) / 60000)
        if (diffMin > 0 && diffMin < 360) {
          const items = meal.meal_items.map(i => i.name).join(', ')
          if (items) proximityNotes.push(`Gatal pertama muncul ${formatDuration(diffMin)} setelah makan ${items}`)
        }
      })
    })

    let summary = `Hari ini kamu ${parts.join(' dan ')}.`
    if (proximityNotes.length > 0) summary += ` ${proximityNotes[0]}.`
    return summary
  }, [dayMeals, dayItch])

  // Calendar data
  const [year, month] = viewMonth.split('-').map(Number)
  const monthStart = startOfMonth(new Date(year, month - 1))
  const monthEnd = endOfMonth(monthStart)
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const firstDayOfWeek = (monthStart.getDay() + 6) % 7

  // List mode: all dates with data, sorted newest first
  const datesWithData = useMemo(() => {
    const allDates = new Set<string>()
    meals.forEach(m => allDates.add(getDateWIB(m.eaten_at)))
    itchEvents.forEach(e => allDates.add(getDateWIB(e.started_at)))
    return Array.from(allDates).sort((a, b) => b.localeCompare(a))
  }, [meals, itchEvents])

  return (
    <div className="px-4 pt-4 pb-2 space-y-4 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Riwayat</h1>
        {/* Calendar / List toggle */}
        <div className="flex rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setViewMode('calendar')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all',
              viewMode === 'calendar' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
            aria-pressed={viewMode === 'calendar'}
          >
            <LayoutGrid className="w-4 h-4" /> Kalender
          </button>
          <div className="w-px bg-border" />
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all',
              viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
            aria-pressed={viewMode === 'list'}
          >
            <List className="w-4 h-4" /> Daftar
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <>
          {/* ── Calendar ── */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {/* Month nav */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <button
                onClick={() => {
                  const prev = subDays(monthStart, 1)
                  setViewMonth(format(startOfMonth(prev), 'yyyy-MM'))
                }}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Bulan sebelumnya"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <p className="font-semibold capitalize">
                {format(monthStart, 'MMMM yyyy', { locale: idLocale })}
              </p>
              <button
                onClick={() => {
                  const next = addDays(monthEnd, 1)
                  setViewMonth(format(startOfMonth(next), 'yyyy-MM'))
                }}
                disabled={viewMonth >= today.slice(0, 7)}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Bulan berikutnya"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="px-3 pb-3 pt-2">
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => (
                  <div key={d} className="text-center py-1" style={{ fontSize: '12px', color: 'var(--color-muted-foreground)' }}>{d}</div>
                ))}
              </div>
              {/* Days */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {calendarDays.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const dayItchEvents = itchByDate.get(dateStr) ?? []
                  const maxSev = dayItchEvents.length > 0
                    ? Math.max(...dayItchEvents.map(e => e.severity ?? 0))
                    : null
                  const isSelected = dateStr === selectedDate
                  const isToday = dateStr === today
                  const hasMeals = (mealsByDate.get(dateStr) ?? []).length > 0
                  const isFuture = dateStr > today

                  return (
                    <button
                      key={dateStr}
                      onClick={() => !isFuture && setSelectedDate(dateStr)}
                      disabled={isFuture}
                      className={cn(
                        'relative flex flex-col items-center justify-center rounded-xl transition-all',
                        'min-h-[44px]',  // 44px cell height per spec
                        isFuture && 'opacity-30 cursor-not-allowed',
                        isSelected && 'ring-2 ring-primary ring-offset-1 ring-offset-card',
                        isToday && !isSelected && 'ring-2 ring-primary/40',
                        maxSev !== null
                          ? calendarDayColor(maxSev)
                          : hasMeals
                            ? 'bg-primary/10 text-primary hover:bg-primary/20'
                            : 'text-foreground hover:bg-secondary'
                      )}
                      aria-label={`${dateStr}${isFuture ? ', belum tersedia' : ''}`}
                      aria-pressed={isSelected}
                    >
                      <span className="text-base font-semibold">{getDate(day)}</span>
                      {dayItchEvents.length > 0 && (
                        <span className="text-[10px] leading-none mt-0.5">
                          🔥{dayItchEvents.length}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="px-4 pb-3 flex gap-4 flex-wrap justify-center border-t border-border pt-2">
              {[
                { label: 'Tidak gatal', cls: 'bg-primary/15' },
                { label: 'Ringan', cls: 'bg-yellow-500/25' },
                { label: 'Sedang', cls: 'bg-orange-500/25' },
                { label: 'Parah', cls: 'bg-red-500/25' },
              ].map(({ label, cls }) => (
                <span key={label} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className={cn('w-3 h-3 rounded', cls)} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* ── Date nav + detail ── */}
          <div ref={detailRef} className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-border hover:bg-secondary transition-colors"
                aria-label="Hari sebelumnya"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <p className="flex-1 text-center text-base font-semibold capitalize">
                {formatDateWIB(selectedDate + 'T12:00:00+07:00')}
              </p>
              <button
                onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
                disabled={selectedDate >= today}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-border hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Hari berikutnya"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <DayDetail
              date={selectedDate}
              dayMeals={dayMeals}
              dayItch={dayItch}
              dayMeds={dayMeds}
              dayContext={dayContext}
              autoSummary={autoSummary}
              medLogs={medLogs}
            />
          </div>
        </>
      ) : (
        /* ── List view ── */
        <div className="space-y-2">
          {datesWithData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Belum ada data tercatat.</p>
            </div>
          ) : datesWithData.map(dateStr => {
            const dayItchEvt = itchByDate.get(dateStr) ?? []
            const dayMealsEvt = mealsByDate.get(dateStr) ?? []
            const maxSev = dayItchEvt.length > 0 ? Math.max(...dayItchEvt.map(e => e.severity ?? 0)) : null
            const isSelected = dateStr === selectedDate

            return (
              <button
                key={dateStr}
                onClick={() => { setSelectedDate(dateStr); setViewMode('calendar') }}
                className={cn(
                  'w-full text-left rounded-2xl border px-4 py-3 transition-all',
                  isSelected ? 'border-primary/50 bg-primary/10' : 'border-border bg-card hover:border-primary/30'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0',
                    maxSev !== null ? calendarDayColor(maxSev) : 'bg-secondary text-muted-foreground'
                  )}>
                    {format(parseISO(dateStr), 'd')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold capitalize">
                      {format(parseISO(dateStr), 'EEEE, d MMM', { locale: idLocale })}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {dayMealsEvt.length > 0 ? `${dayMealsEvt.length}× makan` : ''}
                      {dayItchEvt.length > 0 ? ` · ${dayItchEvt.length}× gatal` : ''}
                      {dayItchEvt.length === 0 && dayMealsEvt.length > 0 ? ' · tidak gatal' : ''}
                    </p>
                  </div>
                  {maxSev !== null && (
                    <span className={cn('text-sm font-bold shrink-0', severityColor(maxSev))}>
                      {maxSev}/10
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Day Detail Component ──
function DayDetail({
  date, dayMeals, dayItch, dayMeds, dayContext, autoSummary, medLogs,
}: {
  date: string
  dayMeals: MealWithItems[]
  dayItch: ItchEvent[]
  dayMeds: MedLogWithMed[]
  dayContext: DailyContext | null
  autoSummary: string
  medLogs: MedLogWithMed[]
}) {
  const hasAnyData = dayMeals.length > 0 || dayItch.length > 0 || dayMeds.length > 0

  if (!hasAnyData) {
    return (
      <div className="text-center py-8 text-muted-foreground rounded-2xl border border-dashed border-border">
        <p className="text-sm">Tidak ada catatan untuk hari ini.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Summary sentence */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
        <p className="text-base leading-relaxed text-muted-foreground">{autoSummary}</p>
      </div>

      {/* Meals */}
      {dayMeals.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <UtensilsCrossed className="w-4 h-4 text-primary" />
            <span className="font-semibold text-base">Makan ({dayMeals.length}×)</span>
          </div>
          <div className="divide-y divide-border">
            {dayMeals.sort((a, b) => a.eaten_at.localeCompare(b.eaten_at)).map(meal => (
              <div key={meal.id} className="flex gap-3 px-4 py-3">
                <span className="text-base font-medium text-muted-foreground w-12 shrink-0">
                  {formatTimeWIB(meal.eaten_at)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5">
                    {meal.meal_items.map(item => (
                      <span key={item.id} className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-sm text-primary">
                        {item.name}
                      </span>
                    ))}
                  </div>
                  {meal.notes && <p className="text-sm text-muted-foreground mt-1">{meal.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Itch events */}
      {dayItch.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-base">Episode Gatal ({dayItch.length}×)</span>
          </div>
          <div className="divide-y divide-border">
            {dayItch.sort((a, b) => a.started_at.localeCompare(b.started_at)).map(event => {
              const isDepletion = isOralDepletionEpisode(parseISO(event.started_at), medLogs as Parameters<typeof isOralDepletionEpisode>[1])
              return (
                <div key={event.id} className={cn('px-4 py-3', isDepletion && 'bg-red-950/20')}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-base font-medium text-muted-foreground">{formatTimeWIB(event.started_at)}</span>
                    <span className={cn('text-base font-bold', severityColor(event.severity ?? 5))}>
                      {severityLabel(event.severity ?? 5)} {event.severity}/10
                    </span>
                  </div>
                  {event.body_areas?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {event.body_areas.map(a => (
                        <span key={a} className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-sm text-amber-300">{a}</span>
                      ))}
                    </div>
                  )}
                  {event.has_bumps && <p className="text-sm text-amber-400">Ada bentol</p>}
                  {isDepletion && <p className="text-sm text-red-400 mt-1">⚠️ Kemungkinan efek obat habis — tidak dihitung ke analisis makanan</p>}
                  {event.notes && <p className="text-sm text-muted-foreground mt-1">{event.notes}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Meds */}
      {dayMeds.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Pill className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-base">Obat ({dayMeds.length}×)</span>
          </div>
          <div className="divide-y divide-border">
            {dayMeds.sort((a, b) => a.taken_at.localeCompare(b.taken_at)).map(log => (
              <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-base font-medium text-muted-foreground w-12 shrink-0">{formatTimeWIB(log.taken_at)}</span>
                <span className="text-base font-medium flex-1">{log.medication.name}</span>
                <span className={cn(
                  'text-sm px-2.5 py-1 rounded-full border',
                  log.medication.kind === 'oral'
                    ? 'bg-blue-500/15 border-blue-500/25 text-blue-300'
                    : 'bg-purple-500/15 border-purple-500/25 text-purple-300'
                )}>
                  {log.medication.kind === 'oral' ? 'Oral' : 'Salep'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily context */}
      {dayContext && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <SunMedium className="w-4 h-4 text-yellow-400" />
            <span className="font-semibold text-base">Konteks Harian</span>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            {dayContext.stress != null && (
              <p className="text-base"><span className="text-muted-foreground">Stres: </span>{STRESS_EMOJIS[dayContext.stress]} {dayContext.stress}/5</p>
            )}
            {dayContext.sleep_hours != null && (
              <p className="text-base"><span className="text-muted-foreground">Tidur: </span>{dayContext.sleep_hours} jam</p>
            )}
            {dayContext.weather_notes && (
              <p className="text-base"><span className="text-muted-foreground">Cuaca: </span>{dayContext.weather_notes}</p>
            )}
            {dayContext.new_products && (
              <p className="text-base"><span className="text-muted-foreground">Produk baru: </span>{dayContext.new_products}</p>
            )}
            {dayContext.notes && (
              <p className="text-base"><span className="text-muted-foreground">Catatan: </span>{dayContext.notes}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
