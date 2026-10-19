'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { showToast } from '@/components/ui/toaster'
import { getNowLocalISO, localToUTC } from '@/lib/timezone'
import { cn } from '@/lib/utils'
import { Pill } from 'lucide-react'
import type { Medication, MedicationLog } from '@/lib/database.types'

interface MedLogWithMed extends MedicationLog {
  medication: Medication
}

interface MedFormProps {
  open: boolean
  onClose: () => void
  userId: string
  medications: Medication[]
  editData?: MedLogWithMed | null
  onSave: (log: MedLogWithMed) => void
}

export function MedForm({ open, onClose, userId, medications, editData, onSave }: MedFormProps) {
  const [takenAt, setTakenAt] = useState(getNowLocalISO())
  const [selectedMedId, setSelectedMedId] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      if (editData) {
        const utcDate = new Date(editData.taken_at)
        const localISO = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000)
          .toISOString().slice(0, 16)
        setTakenAt(localISO)
        setSelectedMedId(editData.medication_id)
        setNotes(editData.notes ?? '')
      } else {
        setTakenAt(getNowLocalISO())
        setSelectedMedId(medications[0]?.id ?? '')
        setNotes('')
      }
    }
  }, [open, editData, medications])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMedId) {
      showToast({ title: 'Pilih obat terlebih dahulu', variant: 'destructive' })
      return
    }
    setLoading(true)

    try {
      const takenAtUTC = localToUTC(takenAt)
      const selectedMed = medications.find(m => m.id === selectedMedId)!

      if (editData) {
        const { data, error } = await supabase
          .from('medication_logs')
          .update({ taken_at: takenAtUTC, medication_id: selectedMedId, notes: notes || null })
          .eq('id', editData.id)
          .select()
          .single()
        if (error) throw error
        showToast({ title: 'Log obat diperbarui', variant: 'success' })
        onSave({ ...data, medication: selectedMed })
      } else {
        const { data, error } = await supabase
          .from('medication_logs')
          .insert({ user_id: userId, medication_id: selectedMedId, taken_at: takenAtUTC, notes: notes || null })
          .select()
          .single()
        if (error) throw error
        showToast({ title: 'Obat berhasil dicatat!', variant: 'success' })
        onSave({ ...data, medication: selectedMed })
      }
      onClose()
    } catch {
      showToast({ title: 'Gagal menyimpan', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const oralMeds = medications.filter(m => m.kind === 'oral')
  const topicalMeds = medications.filter(m => m.kind === 'topical')

  if (medications.length === 0) {
    return (
      <Dialog open={open} onOpenChange={o => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-cyan-400" />
              Catat Obat
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Belum ada obat terdaftar. Tambahkan obat di halaman Pengaturan terlebih dahulu.
          </p>
          <Button onClick={onClose} variant="outline" className="w-full mt-4">
            Tutup
          </Button>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-cyan-400" />
            {editData ? 'Edit Log Obat' : 'Catat Pemakaian Obat'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Pilih Obat</Label>

            {oralMeds.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Obat Minum (Oral)</p>
                <div className="grid gap-2">
                  {oralMeds.map(med => (
                    <button
                      key={med.id}
                      type="button"
                      onClick={() => setSelectedMedId(med.id)}
                      className={cn(
                        'text-left px-3 py-2.5 rounded-xl border text-sm transition-all',
                        selectedMedId === med.id
                          ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                          : 'border-border hover:border-cyan-500/30'
                      )}
                    >
                      <span className="font-medium">{med.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        Interval {med.interval_hours} jam
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {topicalMeds.length > 0 && (
              <div className="space-y-1 mt-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Salep / Topikal</p>
                <div className="grid gap-2">
                  {topicalMeds.map(med => (
                    <button
                      key={med.id}
                      type="button"
                      onClick={() => setSelectedMedId(med.id)}
                      className={cn(
                        'text-left px-3 py-2.5 rounded-xl border text-sm transition-all',
                        selectedMedId === med.id
                          ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                          : 'border-border hover:border-purple-500/30'
                      )}
                    >
                      <span className="font-medium">{med.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">Salep</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="med-time">Waktu Dipakai</Label>
            <Input
              id="med-time"
              type="datetime-local"
              value={takenAt}
              onChange={e => setTakenAt(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="med-notes">Catatan (opsional)</Label>
            <Textarea
              id="med-notes"
              placeholder="Catatan tambahan..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" variant="secondary" className="flex-1 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10" loading={loading}>
              Simpan
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
