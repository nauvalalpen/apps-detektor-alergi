'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { Slider } from '@/components/ui/badge'
import { showToast } from '@/components/ui/toaster'
import { cn, WEATHER_OPTIONS } from '@/lib/utils'
import { SunMedium } from 'lucide-react'
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
    setWeatherNotes(prev =>
      prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const payload = {
        user_id: userId,
        date,
        stress,
        sleep_hours: sleepHours,
        weather_notes: weatherNotes.join(', ') || null,
        new_products: newProducts || null,
        notes: notes || null,
      }

      const { data, error } = await supabase
        .from('daily_context')
        .upsert(payload, { onConflict: 'user_id,date' })
        .select()
        .single()

      if (error) throw error
      showToast({ title: 'Konteks harian disimpan!', variant: 'success' })
      onSave(data)
      onClose()
    } catch {
      showToast({ title: 'Gagal menyimpan', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const stressLabels = ['', 'Sangat Santai', 'Santai', 'Biasa', 'Stres', 'Sangat Stres']
  const stressColors = ['', 'text-emerald-400', 'text-green-400', 'text-yellow-400', 'text-orange-400', 'text-red-400']

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SunMedium className="w-5 h-5 text-yellow-400" />
            Konteks Harian
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>
              Tingkat Stres:{' '}
              <span className={cn('font-bold', stressColors[stress])}>
                {stress}/5 – {stressLabels[stress]}
              </span>
            </Label>
            <Slider
              value={stress}
              onChange={setStress}
              min={1}
              max={5}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 = sangat santai</span>
              <span>5 = sangat stres</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Jam Tidur:{' '}
              <span className="font-bold text-cyan-400">{sleepHours} jam</span>
            </Label>
            <Slider
              value={sleepHours}
              onChange={setSleepHours}
              min={0}
              max={12}
              step={0.5}
            />
          </div>

          <div className="space-y-2">
            <Label>Kondisi Cuaca / Lingkungan</Label>
            <div className="flex flex-wrap gap-2">
              {WEATHER_OPTIONS.map(w => (
                <button
                  key={w}
                  type="button"
                  onClick={() => toggleWeather(w)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-sm border transition-all',
                    weatherNotes.includes(w)
                      ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                      : 'border-border text-muted-foreground hover:border-yellow-500/30'
                  )}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-products">Produk Baru Kontak Kulit (opsional)</Label>
            <Input
              id="new-products"
              placeholder="Misal: sabun baru, deterjen, lotion..."
              value={newProducts}
              onChange={e => setNewProducts(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ctx-notes">Catatan Bebas (opsional)</Label>
            <Textarea
              id="ctx-notes"
              placeholder="Hal lain yang mungkin relevan hari ini..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" className="flex-1" loading={loading}>
              Simpan
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
