'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/badge'
import { showToast } from '@/components/ui/toaster'
import { getNowLocalISO, localToUTC, severityLabel } from '@/lib/timezone'
import { cn, BODY_AREAS } from '@/lib/utils'
import { Zap } from 'lucide-react'
import type { ItchEvent } from '@/lib/database.types'

interface ItchFormProps {
  open: boolean
  onClose: () => void
  userId: string
  editData?: ItchEvent | null
  onSave: (event: ItchEvent) => void
  quickMode?: boolean // langsung simpan tanpa konfirmasi
}

export function ItchForm({ open, onClose, userId, editData, onSave, quickMode }: ItchFormProps) {
  const [startedAt, setStartedAt] = useState(getNowLocalISO())
  const [severity, setSeverity] = useState(5)
  const [bodyAreas, setBodyAreas] = useState<string[]>([])
  const [hasBumps, setHasBumps] = useState(false)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      if (editData) {
        const utcDate = new Date(editData.started_at)
        const localISO = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000)
          .toISOString().slice(0, 16)
        setStartedAt(localISO)
        setSeverity(editData.severity ?? 5)
        setBodyAreas(editData.body_areas ?? [])
        setHasBumps(editData.has_bumps ?? false)
        setNotes(editData.notes ?? '')
      } else {
        setStartedAt(getNowLocalISO())
        setSeverity(5)
        setBodyAreas([])
        setHasBumps(false)
        setNotes('')
      }
    }
  }, [open, editData])

  function toggleArea(area: string) {
    setBodyAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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
      } satisfies Database['public']['Tables']['itch_events']['Insert']

      if (editData) {
        const { data, error } = await supabase
          .from('itch_events')
          .update(payload)
          .eq('id', editData.id)
          .select()
          .single()
        if (error) throw error
        showToast({ title: 'Episode gatal diperbarui', variant: 'success' })
        onSave(data)
      } else {
        const { data, error } = await supabase
          .from('itch_events')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        showToast({ title: 'Gatal berhasil dicatat!', variant: 'success' })
        onSave(data)
      }
      onClose()
    } catch {
      showToast({ title: 'Gagal menyimpan', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const severityColors = (s: number) => {
    if (s <= 2) return 'text-emerald-400'
    if (s <= 4) return 'text-yellow-400'
    if (s <= 6) return 'text-orange-400'
    if (s <= 8) return 'text-red-400'
    return 'text-red-600 font-bold'
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            {editData ? 'Edit Episode Gatal' : 'Catat Gatal'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="itch-time">Mulai Gatal</Label>
            <Input
              id="itch-time"
              type="datetime-local"
              value={startedAt}
              onChange={e => setStartedAt(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Keparahan: <span className={cn('font-bold', severityColors(severity))}>{severity}/10 – {severityLabel(severity)}</span></Label>
            <Slider
              value={severity}
              onChange={setSeverity}
              min={1}
              max={10}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 = sangat ringan</span>
              <span>10 = sangat parah</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Area Tubuh (opsional, boleh pilih banyak)</Label>
            <div className="flex flex-wrap gap-2">
              {BODY_AREAS.map(area => (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleArea(area)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-sm border transition-all',
                    bodyAreas.includes(area)
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'border-border text-muted-foreground hover:border-amber-500/30'
                  )}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setHasBumps(!hasBumps)}
              className={cn(
                'w-12 h-6 rounded-full transition-all relative',
                hasBumps ? 'bg-amber-500' : 'bg-border'
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all',
                hasBumps ? 'left-6' : 'left-0.5'
              )} />
            </button>
            <Label className="mb-0 cursor-pointer" onClick={() => setHasBumps(!hasBumps)}>
              Ada bentol / bilur
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="itch-notes">Catatan (opsional)</Label>
            <Textarea
              id="itch-notes"
              placeholder="Deskripsi tambahan, kondisi saat itu..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" variant="warning" className="flex-1" loading={loading}>
              Simpan
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
