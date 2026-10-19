'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { showToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { Pill, Plus, Pencil, Trash2, Settings, Database, FileDown, AlertTriangle } from 'lucide-react'
import type { Medication } from '@/lib/database.types'
import { ExportButton } from '@/components/export/export-button'

interface PengaturanPageProps {
  medications: Medication[]
  userId: string
  userEmail: string
}

export function PengaturanPage({ medications: initialMeds, userId, userEmail }: PengaturanPageProps) {
  const [medications, setMedications] = useState(initialMeds)
  const [showMedDialog, setShowMedDialog] = useState(false)
  const [editMed, setEditMed] = useState<Medication | null>(null)
  const [showDeleteSeedConfirm, setShowDeleteSeedConfirm] = useState(false)
  const supabase = createClient()

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Pengaturan</h1>
        <p className="text-sm text-muted-foreground mt-1">{userEmail}</p>
      </div>

      {/* Manajemen Obat */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Pill className="w-4 h-4 text-cyan-400" />
              Obat-obatan
            </CardTitle>
            <Button
              size="sm"
              onClick={() => { setEditMed(null); setShowMedDialog(true) }}
              id="btn-add-medication"
            >
              <Plus className="w-4 h-4 mr-1" />
              Tambah
            </Button>
          </div>
          <CardDescription>Daftar obat yang Anda gunakan. Obat oral digunakan untuk mendeteksi efek obat habis.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {medications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Belum ada obat. Tambahkan obat Anda.
            </p>
          ) : (
            medications.map(med => (
              <div key={med.id} className={cn(
                'flex items-center gap-3 p-3 rounded-xl border transition-all',
                med.active ? 'border-border bg-card' : 'border-border/50 bg-secondary/20 opacity-60'
              )}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{med.name}</span>
                    <Badge variant={med.kind === 'oral' ? 'info' : 'muted'}>
                      {med.kind === 'oral' ? 'Oral' : 'Salep'}
                    </Badge>
                    {!med.active && <Badge variant="muted">Nonaktif</Badge>}
                  </div>
                  {med.kind === 'oral' && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Interval: {med.interval_hours} jam
                      {med.reminder_hour != null ? ` · Pengingat: pukul ${String(med.reminder_hour).padStart(2, '0')}:00` : ''}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditMed(med); setShowMedDialog(true) }}
                    className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Hapus ${med.name}? Log pemakaian akan ikut terhapus.`)) return
                      const { error } = await supabase.from('medications').delete().eq('id', med.id)
                      if (!error) {
                        setMedications(prev => prev.filter(m => m.id !== med.id))
                        showToast({ title: 'Obat dihapus', variant: 'default' })
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-950/50 text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Ekspor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="w-4 h-4 text-primary" />
            Ekspor Data
          </CardTitle>
          <CardDescription>Ekspor ringkasan untuk dokter atau unduh data mentah</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <ExportButton userId={userId} />
        </CardContent>
      </Card>

      {/* Data contoh */}
      <Card className="border-amber-800/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-400" />
            Data Contoh
          </CardTitle>
          <CardDescription>Hapus 14 hari data contoh yang dimasukkan saat setup</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Button
            variant="warning"
            onClick={() => setShowDeleteSeedConfirm(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Hapus Data Contoh
          </Button>
        </CardContent>
      </Card>

      {/* Tentang */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-muted-foreground" />
            Tentang Aplikasi
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-sm text-muted-foreground space-y-1">
          <p>AlergiTrack v1.0 – Jurnal Alergi untuk Penderita Eksim</p>
          <p>Data tersimpan di Supabase dengan enkripsi dan Row Level Security.</p>
          <p className="text-amber-400/80 text-xs mt-2">
            ⚠️ Hasil analisis bukan diagnosis medis. Selalu konsultasikan dengan dokter Anda.
          </p>
        </CardContent>
      </Card>

      {/* Dialog tambah/edit obat */}
      <MedicationDialog
        open={showMedDialog}
        onClose={() => { setShowMedDialog(false); setEditMed(null) }}
        userId={userId}
        editData={editMed}
        onSave={med => {
          if (editMed) {
            setMedications(prev => prev.map(m => m.id === med.id ? med : m))
          } else {
            setMedications(prev => [...prev, med])
          }
        }}
      />

      {/* Konfirmasi hapus seed */}
      <Dialog open={showDeleteSeedConfirm} onOpenChange={setShowDeleteSeedConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              Hapus Data Contoh
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ini akan menghapus SEMUA data Anda (makan, gatal, obat, konteks harian). Tindakan ini tidak bisa dibatalkan.
          </p>
          <div className="flex gap-2 mt-4">
            <DialogClose asChild>
              <Button variant="ghost" className="flex-1">Batal</Button>
            </DialogClose>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={async () => {
                await Promise.all([
                  supabase.from('meals').delete().eq('user_id', userId),
                  supabase.from('itch_events').delete().eq('user_id', userId),
                  supabase.from('medication_logs').delete().eq('user_id', userId),
                  supabase.from('daily_context').delete().eq('user_id', userId),
                ])
                showToast({ title: 'Semua data berhasil dihapus', variant: 'default' })
                setShowDeleteSeedConfirm(false)
              }}
            >
              Ya, Hapus Semua
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MedicationDialog({ open, onClose, userId, editData, onSave }: {
  open: boolean
  onClose: () => void
  userId: string
  editData: Medication | null
  onSave: (med: Medication) => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'oral' | 'topical'>('oral')
  const [intervalHours, setIntervalHours] = useState(24)
  const [reminderHour, setReminderHour] = useState<string>('')
  const [active, setActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useState(() => {
    if (editData) {
      setName(editData.name)
      setKind(editData.kind)
      setIntervalHours(editData.interval_hours)
      setReminderHour(editData.reminder_hour != null ? String(editData.reminder_hour) : '')
      setActive(editData.active)
    } else {
      setName('')
      setKind('oral')
      setIntervalHours(24)
      setReminderHour('')
      setActive(true)
    }
  })

  // Reset when opening
  if (typeof window !== 'undefined') {
    // handled by useEffect pattern in parent
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        user_id: userId,
        name: name.trim(),
        kind,
        interval_hours: intervalHours,
        reminder_hour: reminderHour ? Number(reminderHour) : null,
        active,
      }

      if (editData) {
        const { data, error } = await supabase
          .from('medications')
          .update(payload)
          .eq('id', editData.id)
          .select()
          .single()
        if (error) throw error
        showToast({ title: 'Obat diperbarui', variant: 'success' })
        onSave(data)
      } else {
        const { data, error } = await supabase
          .from('medications')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        showToast({ title: 'Obat ditambahkan!', variant: 'success' })
        onSave(data)
      }
      onClose()
    } catch {
      showToast({ title: 'Gagal menyimpan', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-cyan-400" />
            {editData ? 'Edit Obat' : 'Tambah Obat'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="med-name">Nama Obat</Label>
            <Input
              id="med-name"
              placeholder="Misal: Cetirizine 10mg"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Jenis</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['oral', 'topical'] as const).map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={cn(
                    'py-2 rounded-xl border text-sm font-medium transition-all',
                    kind === k
                      ? k === 'oral' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                      : 'border-border text-muted-foreground hover:border-primary/30'
                  )}
                >
                  {k === 'oral' ? '💊 Obat Minum' : '🧴 Salep / Topikal'}
                </button>
              ))}
            </div>
          </div>

          {kind === 'oral' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="interval">Interval Penggunaan (jam)</Label>
                <Input
                  id="interval"
                  type="number"
                  min={1}
                  max={72}
                  value={intervalHours}
                  onChange={e => setIntervalHours(Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reminder">Jam Pengingat (opsional, 0-23)</Label>
                <Input
                  id="reminder"
                  type="number"
                  min={0}
                  max={23}
                  placeholder="Misal: 20 (pukul 20:00)"
                  value={reminderHour}
                  onChange={e => setReminderHour(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActive(!active)}
              className={cn('w-12 h-6 rounded-full transition-all relative', active ? 'bg-primary' : 'bg-border')}
            >
              <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all', active ? 'left-6' : 'left-0.5')} />
            </button>
            <Label className="mb-0">Aktif</Label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Batal</Button>
            <Button type="submit" className="flex-1" loading={loading}>Simpan</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
