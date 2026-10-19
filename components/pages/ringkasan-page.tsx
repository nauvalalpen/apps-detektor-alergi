'use client'

import { useState, useMemo } from 'react'
import { addDays, subDays, format, parseISO, eachDayOfInterval, startOfMonth, endOfMonth, getDate } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar, UtensilsCrossed, Zap, Pill, SunMedium } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatWIB, formatTimeWIB, formatDateWIB, getDateWIB, minutesDiff, formatDuration } from '@/lib/timezone'
import { cn, severityColor, severityLabel, calendarDayColor } from '@/lib/utils'
import { isOralDepletionEpisode } from '@/lib/analysis'
import type { MealWithItems, ItchEvent, Medication, MedicationLog, DailyContext } from '@/lib/database.types'

interface MedLogWithMed extends MedicationLog { medication: Medication }

interface RingkasanPageProps {
  meals: MealWithItems[]
  itchEvents: ItchEvent[]
  medLogs: MedLogWithMed[]
  medications: Medication[]
  dailyContexts: DailyContext[]
  today: string
  userId: string
}

export function RingkasanPage({ meals, itchEvents, medLogs, medications, dailyContexts, today }: RingkasanPageProps) {
  const [selectedDate, setSelectedDate] = useState(today)
  const [viewMonth, setViewMonth] = useState(() => today.slice(0, 7))

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

  // Data untuk tanggal terpilih
  const dayMeals = mealsByDate.get(selectedDate) ?? []
  const dayItch = itchByDate.get(selectedDate) ?? []
  const dayMeds = medByDate.get(selectedDate) ?? []
  const dayContext = contextByDate.get(selectedDate) ?? null

  // Ringkasan otomatis
  const autoSummary = useMemo(() => {
    if (dayMeals.length === 0 && dayItch.length === 0) return 'Tidak ada data untuk hari ini.'
    const parts: string[] = []
    parts.push(`${dayMeals.length} kali makan`)
    if (dayItch.length > 0) {
      const maxSev = Math.max(...dayItch.map(e => e.severity ?? 0))
      const maxEvent = dayItch.find(e => e.severity === maxSev)
      parts.push(`${dayItch.length} episode gatal (puncak keparahan ${maxSev} jam ${maxEvent ? formatTimeWIB(maxEvent.started_at) : ''})`)

      // Cek kedekatan dengan makanan
      dayItch.forEach(itch => {
        const itchTime = parseISO(itch.started_at)
        dayMeals.forEach(meal => {
          const mealTime = parseISO(meal.eaten_at)
          const diffMin = Math.round((itchTime.getTime() - mealTime.getTime()) / 60000)
          if (diffMin > 0 && diffMin < 360) {
            const items = meal.meal_items.map(i => i.name).join(', ')
            parts.push(`Gatal muncul ${formatDuration(diffMin)} setelah makan ${items}`)
          }
        })
      })
    } else {
      parts.push('tidak ada gatal')
    }

    // Cek obat telat
    dayItch.forEach(itch => {
      if (isOralDepletionEpisode(parseISO(itch.started_at), medLogs as Parameters<typeof isOralDepletionEpisode>[1])) {
        parts.push('⚠️ Ada episode gatal saat obat sudah melewati interval')
      }
    })

    return `Hari ini: ${parts.join('. ')}.`
  }, [dayMeals, dayItch, dayMeds, medLogs])

  // Calendar month
  const [year, month] = viewMonth.split('-').map(Number)
  const monthStart = startOfMonth(new Date(year, month - 1))
  const monthEnd = endOfMonth(monthStart)
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const firstDayOfWeek = (monthStart.getDay() + 6) % 7 // Monday = 0

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Ringkasan Harian</h1>
      </div>

      {/* Kalender bulanan */}
      <Card glass>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              {format(monthStart, 'MMMM yyyy', { locale: idLocale })}
            </CardTitle>
            <div className="flex gap-1">
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => {
                  const prev = subDays(monthStart, 1)
                  setViewMonth(format(startOfMonth(prev), 'yyyy-MM'))
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => {
                  const next = addDays(monthEnd, 1)
                  setViewMonth(format(startOfMonth(next), 'yyyy-MM'))
                }}
                disabled={viewMonth >= today.slice(0, 7)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => (
              <div key={d} className="text-center text-xs text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          {/* Days */}
          <div className="grid grid-cols-7 gap-0.5">
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
                    'relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all',
                    isFuture && 'opacity-20 cursor-not-allowed',
                    isSelected && 'ring-2 ring-primary',
                    isToday && !isSelected && 'ring-1 ring-primary/50',
                    maxSev !== null ? calendarDayColor(maxSev) : hasMeals ? 'hover:bg-secondary' : 'text-muted-foreground/50',
                  )}
                >
                  <span className="text-xs font-medium">{getDate(day)}</span>
                  {dayItchEvents.length > 0 && (
                    <span className="text-[9px] leading-none">🔥{dayItchEvents.length}</span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="flex gap-3 mt-3 text-xs text-muted-foreground justify-center">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/30 inline-block" /> Tidak gatal</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500/30 inline-block" /> Ringan</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500/30 inline-block" /> Sedang</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/30 inline-block" /> Parah</span>
          </div>
        </CardContent>
      </Card>

      {/* Navigasi tanggal */}
      <div className="flex items-center gap-3">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 text-center">
          <p className="text-sm font-semibold">{formatDateWIB(selectedDate + 'T12:00:00+07:00')}</p>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
          disabled={selectedDate >= today}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Ringkasan otomatis */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4">
          <p className="text-sm leading-relaxed text-muted-foreground">{autoSummary}</p>
        </CardContent>
      </Card>

      {/* Detail makan */}
      {dayMeals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <UtensilsCrossed className="w-4 h-4 text-primary" />
              Makan ({dayMeals.length}x)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {dayMeals.sort((a, b) => a.eaten_at.localeCompare(b.eaten_at)).map(meal => (
              <div key={meal.id} className="flex gap-3">
                <span className="text-xs font-mono text-muted-foreground w-12 flex-shrink-0 mt-0.5">
                  {formatTimeWIB(meal.eaten_at)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1">
                    {meal.meal_items.map(item => (
                      <Badge key={item.id} variant="muted">{item.name}</Badge>
                    ))}
                  </div>
                  {meal.notes && <p className="text-xs text-muted-foreground mt-1">{meal.notes}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Detail gatal */}
      {dayItch.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Zap className="w-4 h-4 text-amber-400" />
              Episode Gatal ({dayItch.length}x)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {dayItch.sort((a, b) => a.started_at.localeCompare(b.started_at)).map(event => {
              const isDepletion = isOralDepletionEpisode(parseISO(event.started_at), medLogs as Parameters<typeof isOralDepletionEpisode>[1])
              return (
                <div key={event.id} className={cn('rounded-xl p-3 border', isDepletion ? 'bg-red-950/30 border-red-800/50' : 'bg-amber-950/20 border-amber-800/30')}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-muted-foreground">{formatTimeWIB(event.started_at)}</span>
                    <span className={cn('text-sm font-bold', severityColor(event.severity ?? 5))}>
                      {event.severity}/10 – {severityLabel(event.severity ?? 5)}
                    </span>
                  </div>
                  {event.body_areas?.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Area: {event.body_areas.join(', ')}
                    </p>
                  )}
                  {event.has_bumps && <p className="text-xs text-amber-400">Ada bentol</p>}
                  {isDepletion && (
                    <p className="text-xs text-red-400 mt-1">⚠️ Kemungkinan efek obat habis – tidak dihitung ke analisis makanan</p>
                  )}
                  {event.notes && <p className="text-xs text-muted-foreground mt-1">{event.notes}</p>}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Detail obat */}
      {dayMeds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Pill className="w-4 h-4 text-cyan-400" />
              Obat ({dayMeds.length}x)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {dayMeds.sort((a, b) => a.taken_at.localeCompare(b.taken_at)).map(log => (
              <div key={log.id} className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-12">{formatTimeWIB(log.taken_at)}</span>
                <span className="text-sm">{log.medication.name}</span>
                <Badge variant={log.medication.kind === 'oral' ? 'info' : 'muted'}>
                  {log.medication.kind === 'oral' ? 'Oral' : 'Salep'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Konteks harian */}
      {dayContext && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <SunMedium className="w-4 h-4 text-yellow-400" />
              Konteks Harian
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1.5 text-sm">
            {dayContext.stress && (
              <p><span className="text-muted-foreground">Stres:</span> {dayContext.stress}/5</p>
            )}
            {dayContext.sleep_hours && (
              <p><span className="text-muted-foreground">Tidur:</span> {dayContext.sleep_hours} jam</p>
            )}
            {dayContext.weather_notes && (
              <p><span className="text-muted-foreground">Cuaca:</span> {dayContext.weather_notes}</p>
            )}
            {dayContext.new_products && (
              <p><span className="text-muted-foreground">Produk baru:</span> {dayContext.new_products}</p>
            )}
            {dayContext.notes && (
              <p><span className="text-muted-foreground">Catatan:</span> {dayContext.notes}</p>
            )}
          </CardContent>
        </Card>
      )}

      {dayMeals.length === 0 && dayItch.length === 0 && dayMeds.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>Tidak ada data untuk tanggal ini.</p>
        </div>
      )}
    </div>
  )
}
