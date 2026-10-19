'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { showToast } from '@/components/ui/toaster'
import { getNowLocalISO, localToUTC, formatTimeWIB } from '@/lib/timezone'
import { cn } from '@/lib/utils'
import { Pill, Clock, Settings } from 'lucide-react'
import type { Medication, MedicationLog } from '@/lib/database.types'
import Link from 'next/link'

interface MedLogWithMed extends MedicationLog { medication: Medication }

interface MedFormProps {
  open: boolean
  onClose: () => void
  userId: string
  medications: Medication[]
  editData?: MedLogWithMed | null
  onSave: (log: MedLogWithMed) => void
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

export function MedForm({ open, onClose, userId, medications, editData, onSave }: MedFormProps) {
  const [takenAt, setTakenAt] = useState(getNowLocalISO())
  const [selectedPreset, setSelectedPreset] = useState(0)
  const [showCustomTime, setShowCustomTime] = useState(false)
  const [selectedMedId, setSelectedMedId] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      if (editData) {
        const utcDate = new Date(editData.taken_at)
        const localISO = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16)
        setTakenAt(localISO)
        setSelectedMedId(editData.medication_id)
        setNotes(editData.notes ?? '')
        setShowCustomTime(true)
        setSelectedPreset(-1)
      } else {
        setTakenAt(getNowLocalISO())
        setSelectedMedId(medications[0]?.id ?? '')
        setNotes('')
        setShowCustomTime(false)
        setSelectedPreset(0)
      }
    }
  }, [open, editData, medications])

  function handlePresetSelect(idx: number, offset: number) {
    setSelectedPreset(idx)
    setShowCustomTime(false)
    setTakenAt(getOffsetISO(offset))
  }

  async function handleSubmit() {
    if (!selectedMedId) {
      showToast({ title: 'Pilih obat terlebih dahulu', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const takenAtUTC = localToUTC(takenAt)
      const selectedMed = medications.find(m => m.id === selectedMedId)!
      if (editData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from('medication_logs') as any)
          .update({ taken_at: takenAtUTC, medication_id: selectedMedId, notes: notes || null })
          .eq('id', editData.id).select().single()
        if (error) throw error
        showToast({ title: 'Log obat diperbarui', variant: 'success' })
        onSave({ ...data, medication: selectedMed })
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from('medication_logs') as any)
          .insert({ user_id: userId, medication_id: selectedMedId, taken_at: takenAtUTC, notes: notes || null })
          .select().single()
        if (error) throw error
        showToast({ title: 'Obat berhasil dicatat!', variant: 'success' })
        onSave({ ...data, medication: selectedMed })
      }
      onClose()
    } catch {
      showToast({ title: 'Gagal menyimpan, coba lagi', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (medications.length === 0) {
    return (
      <BottomSheet open={open} onClose={onClose} title="Catat Obat">
        <div className="px-4 py-6 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <Pill className="w-8 h-8 text-blue-400" />
          </div>
          <p className="font-semibold">Belum ada obat terdaftar</p>
          <p className="text-sm text-muted-foreground">Tambahkan obatmu di Pengaturan agar efek obat habis bisa dipantau</p>
          <Link href="/pengaturan" onClick={onClose}>
            <Button className="w-full h-12">
              <Settings className="w-4 h-4 mr-2" /> Kelola Obat
            </Button>
          </Link>
        </div>
      </BottomSheet>
    )
  }

  const oralMeds = medications.filter(m => m.kind === 'oral')
  const topicalMeds = medications.filter(m => m.kind === 'topical')
  const displayTime = showCustomTime
    ? formatTimeWIB(localToUTC(takenAt))
    : selectedPreset === -1 ? 'Waktu diatur' : TIME_PRESETS[selectedPreset]?.label ?? 'Sekarang'

  return (
    <BottomSheet open={open} onClose={onClose} title={editData ? 'Edit Log Obat' : 'Catat Pemakaian Obat'}>
      <div className="px-4 py-4 space-y-5">

        {/* Med selection — big tap cards */}
        <div className="space-y-3">
          {oralMeds.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Obat Minum</p>
              <div className="space-y-2">
                {oralMeds.map(med => (
                  <button
                    key={med.id}
                    onClick={() => setSelectedMedId(med.id)}
                    className={cn(
                      'w-full text-left px-4 py-3.5 rounded-2xl border transition-all',
                      selectedMedId === med.id
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-200'
                        : 'border-border bg-card hover:border-blue-500/30'
                    )}
                    aria-pressed={selectedMedId === med.id}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                        selectedMedId === med.id
                          ? 'bg-blue-500/30 border border-blue-400/50'
                          : 'bg-blue-500/15 border border-blue-500/20'
                      )}>
                        <Pill className={cn('w-5 h-5', selectedMedId === med.id ? 'text-blue-300' : 'text-blue-400')} />
                      </div>
                      <div>
                        <p className="font-semibold">{med.name}</p>
                        <p className="text-sm text-muted-foreground">Interval {med.interval_hours} jam</p>
                      </div>
                      {selectedMedId === med.id && (
                        <div className="ml-auto w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                            <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {topicalMeds.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Salep / Topikal</p>
              <div className="space-y-2">
                {topicalMeds.map(med => (
                  <button
                    key={med.id}
                    onClick={() => setSelectedMedId(med.id)}
                    className={cn(
                      'w-full text-left px-4 py-3.5 rounded-2xl border transition-all',
                      selectedMedId === med.id
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-200'
                        : 'border-border bg-card hover:border-purple-500/30'
                    )}
                    aria-pressed={selectedMedId === med.id}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                        selectedMedId === med.id ? 'bg-purple-500/30 border border-purple-400/50' : 'bg-purple-500/15 border border-purple-500/20'
                      )}>
                        <Pill className={cn('w-5 h-5', selectedMedId === med.id ? 'text-purple-300' : 'text-purple-400')} />
                      </div>
                      <p className="font-semibold">{med.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Time presets */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Kapan diminum/dipakai?</p>
          <div className="flex gap-2 flex-wrap">
            {TIME_PRESETS.map((p, idx) => (
              <button
                key={p.label}
                onClick={() => handlePresetSelect(idx, p.offset)}
                className={`px-3 py-2 rounded-full text-sm font-medium border transition-all ${
                  selectedPreset === idx && !showCustomTime
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                    : 'border-border text-muted-foreground hover:border-blue-500/30'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => { setShowCustomTime(true); setSelectedPreset(-1) }}
              className={`px-3 py-2 rounded-full text-sm font-medium border transition-all flex items-center gap-1.5 ${
                showCustomTime ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'border-border text-muted-foreground hover:border-blue-500/30'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Pilih jam
            </button>
          </div>
          {showCustomTime && (
            <input
              type="datetime-local"
              value={takenAt}
              onChange={e => setTakenAt(e.target.value)}
              className="mt-2 w-full bg-secondary border border-border rounded-xl px-3 py-2 text-base"
            />
          )}
          <p className="text-xs text-muted-foreground mt-1">Waktu: {displayTime}</p>
        </div>

        {/* Notes */}
        <div>
          <p className="text-sm font-medium mb-1.5">Catatan (opsional)</p>
          <textarea
            placeholder="Catatan tambahan..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-base placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50 resize-none transition-colors"
          />
        </div>

        {/* Kelola obat link */}
        <p className="text-sm text-center text-muted-foreground">
          Obat tidak ada?{' '}
          <Link href="/pengaturan" onClick={onClose} className="text-primary underline underline-offset-2">
            Kelola obat
          </Link>
        </p>

        {/* Submit */}
        <div className="pb-safe pt-2">
          <Button
            onClick={handleSubmit}
            loading={loading}
            className="w-full h-14 text-base font-bold rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-300 hover:bg-blue-500/30"
          >
            <Pill className="w-5 h-5 mr-2" />
            Simpan Pemakaian Obat
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
