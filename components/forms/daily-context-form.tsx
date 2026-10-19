'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { showToast } from '@/components/ui/toaster'
import { cn, WEATHER_OPTIONS, STRESS_EMOJIS, STRESS_LABELS } from '@/lib/utils'
import { SunMedium, Minus, Plus } from 'lucide-react'
import type { DailyContext } from '@/lib/database.types'

interface DailyContextFormProps {
  open: boolean
  onClose: () => void
  userId: string
  date: string
  editData: DailyContext | null
  onSave: (ctx: DailyContext) => void
}

export function DailyContextForm({ open, onClose, userId, date, editData, onSave }: DailyContextFormProps) {
  const [stress, setStress] = useState(3)
  const [sleepHours, setSleepHours] = useState(7)
  const [weatherNotes, setWeatherNotes] = useState<string[]>([])
  const [newProducts, setNewProducts] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      if (editData) {
        setStress(editData.stress ?? 3)
        setSleepHours(editData.sleep_hours ?? 7)
        setWeatherNotes(editData.weather_notes ? editData.weather_notes.split(',').map(s => s.trim()).filter(Boolean) : [])
        setNewProducts(editData.new_products ?? '')
        setNotes(editData.notes ?? '')
      } else {
        setStress(3)
        setSleepHours(7)
        setWeatherNotes([])
        setNewProducts('')
        setNotes('')
      }
    }
  }, [open, editData])

  function toggleWeather(w: string) {
    setWeatherNotes(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w])
  }

  function adjustSleep(delta: number) {
    setSleepHours(prev => Math.min(12, Math.max(0, Math.round((prev + delta) * 2) / 2)))
  }

  async function handleSubmit() {
    setLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('daily_context') as any)
        .upsert({
          user_id: userId, date, stress, sleep_hours: sleepHours,
          weather_notes: weatherNotes.join(', ') || null,
          new_products: newProducts || null,
          notes: notes || null,
        }, { onConflict: 'user_id,date' })
        .select().single()
      if (error) throw error
      showToast({ title: 'Konteks harian disimpan!', variant: 'success' })
      onSave(data)
      onClose()
    } catch {
      showToast({ title: 'Gagal menyimpan, coba lagi', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Konteks Hari Ini">
      <div className="px-4 py-4 space-y-6">

        {/* Stress — 5 emoji buttons */}
        <div>
          <p className="text-sm font-medium mb-3">Tingkat stres hari ini</p>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                onClick={() => setStress(s)}
                className={cn(
                  'flex flex-col items-center gap-1 py-3 rounded-2xl border transition-all',
                  stress === s
                    ? 'bg-primary/20 border-primary/50 scale-105'
                    : 'border-border hover:border-primary/30'
                )}
                aria-pressed={stress === s}
                aria-label={STRESS_LABELS[s]}
              >
                <span className="text-2xl">{STRESS_EMOJIS[s]}</span>
                <span className="text-xs text-muted-foreground font-medium">{s}</span>
              </button>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-2">
            {STRESS_EMOJIS[stress]} {STRESS_LABELS[stress]}
          </p>
        </div>

        {/* Sleep hours — stepper */}
        <div>
          <p className="text-sm font-medium mb-3">Jam tidur</p>
          <div className="flex items-center justify-between bg-secondary rounded-2xl px-4 py-3">
            <button
              onClick={() => adjustSleep(-0.5)}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-border hover:bg-border/80 transition-colors"
              aria-label="Kurangi 30 menit"
            >
              <Minus className="w-5 h-5" />
            </button>
            <div className="text-center">
              <p className="text-4xl font-bold text-primary">{sleepHours}</p>
              <p className="text-sm text-muted-foreground">jam</p>
            </div>
            <button
              onClick={() => adjustSleep(0.5)}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-border hover:bg-border/80 transition-colors"
              aria-label="Tambah 30 menit"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Weather chips */}
        <div>
          <p className="text-sm font-medium mb-2">Cuaca / lingkungan (opsional)</p>
          <div className="flex flex-wrap gap-2">
            {WEATHER_OPTIONS.map(w => (
              <button
                key={w}
                onClick={() => toggleWeather(w)}
                className={cn(
                  'px-3 py-2 rounded-full text-sm border transition-all',
                  weatherNotes.includes(w)
                    ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300 font-medium'
                    : 'border-border text-muted-foreground hover:border-yellow-500/30'
                )}
                aria-pressed={weatherNotes.includes(w)}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* New products */}
        <div>
          <p className="text-sm font-medium mb-1.5">Produk baru kontak kulit (opsional)</p>
          <input
            placeholder="Misal: sabun baru, deterjen, lotion..."
            value={newProducts}
            onChange={e => setNewProducts(e.target.value)}
            className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-base placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        {/* Notes */}
        <div>
          <p className="text-sm font-medium mb-1.5">Catatan bebas (opsional)</p>
          <textarea
            placeholder="Hal lain yang mungkin relevan hari ini..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-base placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none transition-colors"
          />
        </div>

        {/* Submit */}
        <div className="pb-safe pt-2">
          <Button
            onClick={handleSubmit}
            loading={loading}
            className="w-full h-14 text-base font-bold rounded-2xl glow-green"
          >
            <SunMedium className="w-5 h-5 mr-2" />
            Simpan Konteks
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
