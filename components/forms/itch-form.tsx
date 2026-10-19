'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { showToast } from '@/components/ui/toaster'
import { getNowLocalISO, localToUTC, formatTimeWIB } from '@/lib/timezone'
import { cn, BODY_AREAS, severityLabel } from '@/lib/utils'
import { Zap, Clock, Plus } from 'lucide-react'
import type { ItchEvent } from '@/lib/database.types'

interface ItchFormProps {
  open: boolean
  onClose: () => void
  userId: string
  editData?: ItchEvent | null
  onSave: (event: ItchEvent) => void
}

const TIME_PRESETS = [
  { label: 'Sekarang', offset: 0 },
  { label: '15 mnt lalu', offset: -15 },
  { label: '30 mnt lalu', offset: -30 },
  { label: '1 jam lalu', offset: -60 },
]

function getOffsetISO(offsetMinutes: number): string {
  const now = new Date(Date.now() + offsetMinutes * 60 * 1000)
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16)
}

const SEV_GRID = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function sevColor(s: number) {
  if (s <= 2) return { bg: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300', active: 'bg-emerald-500/40 border-emerald-400 text-emerald-200 font-bold' }
  if (s <= 4) return { bg: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300', active: 'bg-yellow-500/40 border-yellow-400 text-yellow-100 font-bold' }
  if (s <= 6) return { bg: 'bg-orange-500/20 border-orange-500/40 text-orange-300', active: 'bg-orange-500/40 border-orange-400 text-orange-100 font-bold' }
  if (s <= 8) return { bg: 'bg-red-500/20 border-red-500/40 text-red-300', active: 'bg-red-500/40 border-red-400 text-red-100 font-bold' }
  return { bg: 'bg-red-700/20 border-red-600/40 text-red-300', active: 'bg-red-700/50 border-red-500 text-red-100 font-bold' }
}

export function ItchForm({ open, onClose, userId, editData, onSave }: ItchFormProps) {
  const [startedAt, setStartedAt] = useState(getNowLocalISO())
  const [selectedPreset, setSelectedPreset] = useState(0)
  const [showCustomTime, setShowCustomTime] = useState(false)
  const [severity, setSeverity] = useState(5)
  const [bodyAreas, setBodyAreas] = useState<string[]>([])
  const [hasBumps, setHasBumps] = useState(false)
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      if (editData) {
        const utcDate = new Date(editData.started_at)
        const localISO = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16)
        setStartedAt(localISO)
        setSeverity(editData.severity ?? 5)
        setBodyAreas(editData.body_areas ?? [])
        setHasBumps(editData.has_bumps ?? false)
        setNotes(editData.notes ?? '')
        setShowNotes(!!editData.notes)
        setShowCustomTime(true)
        setSelectedPreset(-1)
      } else {
        setStartedAt(getNowLocalISO())
        setSeverity(5)
        setBodyAreas([])
        setHasBumps(false)
        setNotes('')
        setShowNotes(false)
        setShowCustomTime(false)
        setSelectedPreset(0)
      }
    }
  }, [open, editData])

  function handlePresetSelect(idx: number, offset: number) {
    setSelectedPreset(idx)
    setShowCustomTime(false)
    setStartedAt(getOffsetISO(offset))
  }

  function toggleArea(area: string) {
    setBodyAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area])
  }

  async function handleSubmit() {
    setLoading(true)
    try {
      const startedAtUTC = localToUTC(startedAt)
      const payload = {
        user_id: userId,
        started_at: startedAtUTC,
        severity,
        body_areas: bodyAreas,
        has_bumps: hasBumps,
        notes: notes || null,
      }

      if (editData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from('itch_events') as any).update(payload).eq('id', editData.id).select().single()
        if (error) throw error
        showToast({ title: 'Episode gatal diperbarui', variant: 'success' })
        onSave(data as ItchEvent)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from('itch_events') as any).insert(payload).select().single()
        if (error) throw error
        showToast({ title: 'Gatal berhasil dicatat!', variant: 'success' })
        onSave(data as ItchEvent)
      }
      onClose()
    } catch {
      showToast({ title: 'Gagal menyimpan, coba lagi', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const displayTime = showCustomTime
    ? formatTimeWIB(localToUTC(startedAt))
    : selectedPreset === -1 ? 'Waktu diatur' : TIME_PRESETS[selectedPreset]?.label ?? 'Sekarang'

  const sevLabels = ['Ringan', 'Ringan', 'Ringan', 'Ringan', 'Sedang', 'Sedang', 'Parah', 'Parah', 'Sangat parah', 'Sangat parah']

  return (
    <BottomSheet open={open} onClose={onClose} title={editData ? 'Edit Episode Gatal' : 'Detail Gatal'}>
      <div className="px-4 py-4 space-y-5">

        {/* Time presets */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Kapan mulai gatal?</p>
          <div className="flex gap-2 flex-wrap">
            {TIME_PRESETS.map((p, idx) => (
              <button
                key={p.label}
                onClick={() => handlePresetSelect(idx, p.offset)}
                className={`px-3 py-2 rounded-full text-sm font-medium border transition-all ${
                  selectedPreset === idx && !showCustomTime
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'border-border text-muted-foreground hover:border-amber-500/30'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => { setShowCustomTime(true); setSelectedPreset(-1) }}
              className={`px-3 py-2 rounded-full text-sm font-medium border transition-all flex items-center gap-1.5 ${
                showCustomTime
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'border-border text-muted-foreground hover:border-amber-500/30'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Pilih jam
            </button>
          </div>
          {showCustomTime && (
            <input
              type="datetime-local"
              value={startedAt}
              onChange={e => setStartedAt(e.target.value)}
              className="mt-2 w-full bg-secondary border border-border rounded-xl px-3 py-2 text-base"
            />
          )}
          <p className="text-xs text-muted-foreground mt-1">Waktu: {displayTime}</p>
        </div>

        {/* Severity grid 2×5 (NOT a slider) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Keparahan</p>
            <span className={cn(
              'text-sm font-bold px-3 py-1 rounded-full',
              severity <= 2 ? 'text-emerald-300' :
              severity <= 4 ? 'text-yellow-300' :
              severity <= 6 ? 'text-orange-300' :
              severity <= 8 ? 'text-red-300' : 'text-red-200'
            )}>
              {severity}/10 – {severityLabel(severity)}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {SEV_GRID.map(s => {
              const { bg, active } = sevColor(s)
              const isSelected = severity === s
              return (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={cn(
                    'h-12 rounded-xl border text-base font-semibold transition-all active:scale-95',
                    isSelected ? active : bg + ' opacity-60 hover:opacity-90'
                  )}
                  aria-pressed={isSelected}
                  aria-label={`Keparahan ${s}`}
                >
                  {s}
                </button>
              )
            })}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Ringan</span>
            <span>Sedang</span>
            <span>Parah</span>
            <span>Sangat parah</span>
          </div>
        </div>

        {/* Body areas */}
        <div>
          <p className="text-sm font-medium mb-2">Area tubuh (boleh banyak)</p>
          <div className="flex flex-wrap gap-2">
            {BODY_AREAS.map(area => (
              <button
                key={area}
                onClick={() => toggleArea(area)}
                className={cn(
                  'px-3 py-2 rounded-full text-sm border transition-all',
                  bodyAreas.includes(area)
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-medium'
                    : 'border-border text-muted-foreground hover:border-amber-500/30'
                )}
                aria-pressed={bodyAreas.includes(area)}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        {/* Has bumps toggle */}
        <div className="flex items-center gap-3 py-1">
          <button
            type="button"
            role="switch"
            aria-checked={hasBumps}
            onClick={() => setHasBumps(!hasBumps)}
            className={cn(
              'w-14 h-7 rounded-full transition-all relative shrink-0',
              hasBumps ? 'bg-amber-500' : 'bg-border'
            )}
          >
            <span className={cn(
              'absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-all',
              hasBumps ? 'left-7' : 'left-0.5'
            )} />
          </button>
          <span className="text-base font-medium">Ada bentol / bilur</span>
        </div>

        {/* Notes */}
        {!showNotes ? (
          <button
            onClick={() => setShowNotes(true)}
            className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Tambah catatan
          </button>
        ) : (
          <div>
            <p className="text-sm font-medium mb-1.5">Catatan (opsional)</p>
            <textarea
              placeholder="Deskripsi tambahan, kondisi saat itu..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-base placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50 resize-none transition-colors"
            />
          </div>
        )}

        {/* Submit */}
        <div className="pb-safe pt-2">
          <Button
            onClick={handleSubmit}
            loading={loading}
            className="w-full h-14 text-base font-bold rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
          >
            <Zap className="w-5 h-5 mr-2" />
            Simpan Gatal
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
