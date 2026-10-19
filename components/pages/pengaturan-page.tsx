'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { showToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import {
  Pill, Plus, Pencil, Trash2, FileDown, LogOut, Sun, Moon, Monitor,
  ChevronDown, ChevronUp, AlertTriangle, Mail, Settings
} from 'lucide-react'
import type { Medication } from '@/lib/database.types'
import { ExportButton } from '@/components/export/export-button'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface PengaturanPageProps {
  medications: Medication[]
  userId: string
  userEmail: string
  hasSeedData?: boolean
}

export function PengaturanPage({ medications: initialMeds, userId, userEmail, hasSeedData = false }: PengaturanPageProps) {
  const [medications, setMedications] = useState(initialMeds)
  const [showMedSheet, setShowMedSheet] = useState(false)
  const [editMed, setEditMed] = useState<Medication | null>(null)
  const [showDeleteSeedConfirm, setShowDeleteSeedConfirm] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const { theme, setTheme } = useTheme()
  const supabase = createClient()
  const router = useRouter()

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    showToast({ title: 'Berhasil keluar', variant: 'default' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="px-4 pt-4 pb-2 space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold">Pengaturan</h1>

      {/* ── 1. Akun ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-4 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Akun</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userEmail}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Akun aktif</p>
            </div>
          </div>
        </div>
        {/* Logout button (Bug #5 fix) */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full flex items-center gap-3 px-4 py-4 text-red-400 hover:bg-red-950/20 transition-colors"
          id="btn-logout"
        >
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
            <LogOut className="w-5 h-5" />
          </div>
          <span className="text-base font-medium">Keluar</span>
        </button>
      </div>

      {/* ── 2. Obat-obatan ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Pill className="w-4 h-4 text-blue-400" />
            <p className="font-semibold">Obat-obatan</p>
          </div>
          <button
            onClick={() => { setEditMed(null); setShowMedSheet(true) }}
            id="btn-add-medication"
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-primary/15 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/25 transition-all"
          >
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </div>

        {medications.length === 0 ? (
          <div className="px-4 py-8 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Pill className="w-7 h-7 text-blue-400 opacity-60" />
            </div>
            <p className="font-medium text-muted-foreground">Belum ada obat terdaftar</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Tambahkan obat anti-gatal oralmu agar waktu efek habis bisa dipantau di Hari Ini.
            </p>
            <button
              onClick={() => { setEditMed(null); setShowMedSheet(true) }}
              className="mx-auto flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all"
            >
              <Plus className="w-4 h-4" /> Tambah Obat Pertama
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {medications.map(med => (
              <div key={med.id} className={cn(
                'flex items-center gap-3 px-4 py-4 transition-all',
                !med.active && 'opacity-50'
              )}>
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                  med.kind === 'oral'
                    ? 'bg-blue-500/15 border border-blue-500/25'
                    : 'bg-purple-500/15 border border-purple-500/25'
                )}>
                  <Pill className={cn('w-5 h-5', med.kind === 'oral' ? 'text-blue-400' : 'text-purple-400')} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{med.name}</p>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full border font-medium',
                      med.kind === 'oral'
                        ? 'bg-blue-500/15 border-blue-500/25 text-blue-300'
                        : 'bg-purple-500/15 border-purple-500/25 text-purple-300'
                    )}>
                      {med.kind === 'oral' ? 'Oral' : 'Salep'}
                    </span>
                    {!med.active && (
                      <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground">Nonaktif</span>
                    )}
                  </div>
                  {med.kind === 'oral' && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Interval {med.interval_hours} jam
                      {med.reminder_hour != null ? ` · Pengingat pukul ${String(med.reminder_hour).padStart(2, '0')}.00` : ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setEditMed(med); setShowMedSheet(true) }}
                    className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={`Edit ${med.name}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Hapus ${med.name}? Log pemakaian akan ikut terhapus.`)) return
                      const { error } = await supabase.from('medications').delete().eq('id', med.id)
                      if (!error) {
                        setMedications(prev => prev.filter(m => m.id !== med.id))
                        showToast({ title: 'Obat dihapus', variant: 'default' })
                      }
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-red-950/40 text-muted-foreground hover:text-red-400 transition-colors"
                    aria-label={`Hapus ${med.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 3. Tampilan ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tampilan</p>
        </div>
        <div className="p-3 flex gap-2">
          {([
            { value: 'system', Icon: Monitor, label: 'Sistem' },
            { value: 'light', Icon: Sun, label: 'Terang' },
            { value: 'dark', Icon: Moon, label: 'Gelap' },
          ] as const).map(({ value, Icon, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                'flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm font-medium transition-all',
                theme === value
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/30'
              )}
              aria-pressed={theme === value}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 4. Ekspor ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <FileDown className="w-4 h-4 text-primary" />
          <p className="font-semibold">Ekspor Data</p>
        </div>
        <div className="p-4 space-y-2">
          <p className="text-sm text-muted-foreground mb-3">Ekspor data untuk dibagikan ke dokter atau disimpan sendiri.</p>
          <ExportButton userId={userId} />
        </div>
      </div>

      {/* ── 5. Lanjutan (accordion) — only if seed data exists (Bug #4 fix) ── */}
      {hasSeedData && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between px-4 py-4"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-muted-foreground" />
              <p className="font-semibold text-muted-foreground">Lanjutan</p>
            </div>
            {showAdvanced ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showAdvanced && (
            <div className="px-4 pb-4 border-t border-border pt-3">
              <p className="text-sm text-muted-foreground mb-3">Data contoh terdeteksi. Hapus jika sudah tidak diperlukan.</p>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteSeedConfirm(true)}
                className="w-full h-12"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Hapus Data Contoh
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── 6. Tentang ── */}
      <div className="px-4 py-3 text-center space-y-1">
        <p className="text-sm text-muted-foreground">AlergiTrack v1.0 — Jurnal Alergi Harian</p>
        <p className="text-xs text-muted-foreground">Data tersimpan terenkripsi dengan Row Level Security.</p>
        <p className="text-xs text-amber-400/70 mt-2">
          ⚠️ Bukan pengganti diagnosis medis. Konsultasikan dengan dokter.
        </p>
      </div>

      {/* ── Add/Edit Med Sheet ── */}
      <MedicationSheet
        open={showMedSheet}
        onClose={() => { setShowMedSheet(false); setEditMed(null) }}
        userId={userId}
        editData={editMed}
        onSave={med => {
          if (editMed) {
            setMedications(prev => prev.map(m => m.id === med.id ? med : m))
          } else {
            setMedications(prev => [...prev, med])
          }
          setShowMedSheet(false)
          setEditMed(null)
        }}
      />

      {/* ── Logout confirm ── */}
      <BottomSheet open={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} title="Keluar dari AlergiTrack?">
        <div className="px-4 py-4 space-y-4">
          <p className="text-base text-muted-foreground">Data kamu tetap tersimpan di server dan bisa diakses kembali setelah login.</p>
          <div className="flex gap-3 pb-safe">
            <Button variant="outline" className="flex-1 h-12" onClick={() => setShowLogoutConfirm(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              className="flex-1 h-12"
              loading={loggingOut}
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" /> Ya, Keluar
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* ── Delete seed confirm ── */}
      <BottomSheet open={showDeleteSeedConfirm} onClose={() => setShowDeleteSeedConfirm(false)} title="Hapus Semua Data?">
        <div className="px-4 py-4 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-950/30 border border-red-800/50 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">
              Ini akan menghapus SEMUA data (makan, gatal, obat, konteks harian). Tindakan ini tidak bisa dibatalkan.
            </p>
          </div>
          <div className="flex gap-3 pb-safe">
            <Button variant="outline" className="flex-1 h-12" onClick={() => setShowDeleteSeedConfirm(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              className="flex-1 h-12"
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
        </div>
      </BottomSheet>
    </div>
  )
}

// ── Medication Sheet ──
function MedicationSheet({
  open, onClose, userId, editData, onSave,
}: {
  open: boolean
  onClose: () => void
  userId: string
  editData: Medication | null
  onSave: (med: Medication) => void
}) {
  const [name, setName] = useState(editData?.name ?? '')
  const [kind, setKind] = useState<'oral' | 'topical'>(editData?.kind ?? 'oral')
  const [intervalHours, setIntervalHours] = useState(editData?.interval_hours ?? 24)
  const [reminderHour, setReminderHour] = useState<string>(
    editData?.reminder_hour != null ? String(editData.reminder_hour) : ''
  )
  const [active, setActive] = useState(editData?.active ?? true)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  // Reset when editData changes
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

  async function handleSubmit() {
    if (!name.trim()) {
      showToast({ title: 'Nama obat tidak boleh kosong', variant: 'destructive' })
      return
    }
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from('medications') as any).update(payload).eq('id', editData.id).select().single()
        if (error) throw error
        showToast({ title: 'Obat diperbarui', variant: 'success' })
        onSave(data as Medication)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from('medications') as any).insert(payload).select().single()
        if (error) throw error
        showToast({ title: 'Obat ditambahkan!', variant: 'success' })
        onSave(data as Medication)
      }
    } catch {
      showToast({ title: 'Gagal menyimpan, coba lagi', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={editData ? 'Edit Obat' : 'Tambah Obat'}>
      <div className="px-4 py-4 space-y-5">

        {/* Name */}
        <div>
          <p className="text-sm font-medium mb-1.5">Nama Obat</p>
          <input
            placeholder="Misal: Cetirizine 10mg"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-base placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            autoFocus
          />
        </div>

        {/* Kind */}
        <div>
          <p className="text-sm font-medium mb-2">Jenis</p>
          <div className="grid grid-cols-2 gap-2">
            {(['oral', 'topical'] as const).map(k => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={cn(
                  'py-3 rounded-xl border text-sm font-semibold transition-all',
                  kind === k
                    ? k === 'oral'
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                      : 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                    : 'border-border text-muted-foreground hover:border-primary/30'
                )}
                aria-pressed={kind === k}
              >
                {k === 'oral' ? '💊 Obat Minum' : '🧴 Salep / Topikal'}
              </button>
            ))}
          </div>
        </div>

        {/* Oral-specific fields */}
        {kind === 'oral' && (
          <>
            <div>
              <p className="text-sm font-medium mb-1.5">Interval Penggunaan (jam)</p>
              <input
                type="number"
                min={1}
                max={72}
                value={intervalHours}
                onChange={e => setIntervalHours(Number(e.target.value))}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-base focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-1.5">Jam Pengingat (opsional, 0–23)</p>
              <input
                type="number"
                min={0}
                max={23}
                placeholder="Misal: 20 (pukul 20.00)"
                value={reminderHour}
                onChange={e => setReminderHour(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-base placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          </>
        )}

        {/* Active toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={active}
            onClick={() => setActive(!active)}
            className={cn('w-14 h-7 rounded-full transition-all relative shrink-0', active ? 'bg-primary' : 'bg-border')}
          >
            <span className={cn('absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-all', active ? 'left-7' : 'left-0.5')} />
          </button>
          <p className="text-base font-medium">Aktif</p>
        </div>

        {/* Submit */}
        <div className="pb-safe pt-2">
          <Button onClick={handleSubmit} loading={loading} className="w-full h-14 text-base font-bold rounded-2xl glow-green">
            <Pill className="w-5 h-5 mr-2" /> Simpan Obat
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
