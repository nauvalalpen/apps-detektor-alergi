'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { showToast } from '@/components/ui/toaster'
import { getNowLocalISO, localToUTC, formatTimeWIB } from '@/lib/timezone'
import { normalizeItem } from '@/lib/utils'
import { UtensilsCrossed, Plus, X, Clock } from 'lucide-react'
import type { MealWithItems } from '@/lib/database.types'

interface MealFormProps {
  open: boolean
  onClose: () => void
  userId: string
  editData?: MealWithItems | null
  onSave: (meal: MealWithItems) => void
  knownItems: string[]
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

export function MealForm({ open, onClose, userId, editData, onSave, knownItems }: MealFormProps) {
  const [eatenAt, setEatenAt] = useState(getNowLocalISO())
  const [selectedPreset, setSelectedPreset] = useState(0)
  const [showCustomTime, setShowCustomTime] = useState(false)
  const [items, setItems] = useState<string[]>([])
  const [itemInput, setItemInput] = useState('')
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Top 10 frequent items
  const frequentItems = knownItems.slice(0, 10)

  useEffect(() => {
    if (open) {
      if (editData) {
        const utcDate = new Date(editData.eaten_at)
        const localISO = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16)
        setEatenAt(localISO)
        setItems(editData.meal_items.map(i => i.name))
        setNotes(editData.notes ?? '')
        setShowNotes(!!editData.notes)
        setShowCustomTime(true)
        setSelectedPreset(-1)
      } else {
        setEatenAt(getNowLocalISO())
        setItems([])
        setNotes('')
        setShowNotes(false)
        setShowCustomTime(false)
        setSelectedPreset(0)
      }
      setItemInput('')
      setShowSuggestions(false)
    }
  }, [open, editData])

  function handlePresetSelect(idx: number, offset: number) {
    setSelectedPreset(idx)
    setShowCustomTime(false)
    setEatenAt(getOffsetISO(offset))
  }

  function handleItemInput(val: string) {
    setItemInput(val)
    if (val.trim().length >= 1) {
      const norm = normalizeItem(val)
      const filtered = knownItems.filter(k => k.includes(norm) && !items.includes(k)).slice(0, 6)
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }

  function addItem(name: string) {
    const norm = normalizeItem(name)
    if (norm && !items.includes(norm)) setItems(prev => [...prev, norm])
    setItemInput('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  function removeItem(name: string) {
    setItems(prev => prev.filter(i => i !== name))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); if (itemInput.trim()) addItem(itemInput.trim()) }
    if (e.key === ',') { e.preventDefault(); if (itemInput.trim()) addItem(itemInput.replace(',', '').trim()) }
    if (e.key === 'Escape') setShowSuggestions(false)
  }

  async function handleSubmit() {
    if (items.length === 0) {
      showToast({ title: 'Tambah minimal 1 item makanan', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const eatenAtUTC = localToUTC(eatenAt)
      if (editData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('meals') as any).update({ eaten_at: eatenAtUTC, notes: notes || null }).eq('id', editData.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('meal_items') as any).delete().eq('meal_id', editData.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('meal_items') as any).insert(items.map(name => ({ meal_id: editData.id, user_id: userId, name })))
        showToast({ title: 'Makan diperbarui', variant: 'success' })
        onSave({ ...editData, eaten_at: eatenAtUTC, notes: notes || null, meal_items: items.map(name => ({ id: '', meal_id: editData.id, user_id: userId, name, created_at: '' })) })
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: meal, error: mealErr } = await (supabase.from('meals') as any)
          .insert({ user_id: userId, eaten_at: eatenAtUTC, notes: notes || null }).select().single()
        if (mealErr || !meal) throw mealErr ?? new Error('Gagal menyimpan')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: mealItems } = await (supabase.from('meal_items') as any)
          .insert(items.map((name: string) => ({ meal_id: meal.id, user_id: userId, name }))).select()
        showToast({ title: 'Makan berhasil dicatat!', variant: 'success' })
        onSave({ ...meal, meal_items: mealItems ?? [] })
      }
      onClose()
    } catch {
      showToast({ title: 'Gagal menyimpan, coba lagi', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const displayTime = showCustomTime
    ? formatTimeWIB(localToUTC(eatenAt))
    : selectedPreset === -1 ? 'Waktu diatur' : TIME_PRESETS[selectedPreset]?.label ?? 'Sekarang'

  return (
    <BottomSheet open={open} onClose={onClose} title={editData ? 'Edit Makan' : 'Catat Makan'}>
      <div className="px-4 py-4 space-y-5">

        {/* Time presets */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Kapan makan?</p>
          <div className="flex gap-2 flex-wrap">
            {TIME_PRESETS.map((p, idx) => (
              <button
                key={p.label}
                onClick={() => handlePresetSelect(idx, p.offset)}
                className={`px-3 py-2 rounded-full text-sm font-medium border transition-all ${
                  selectedPreset === idx && !showCustomTime
                    ? 'bg-primary/20 border-primary/50 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/30'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => { setShowCustomTime(true); setSelectedPreset(-1) }}
              className={`px-3 py-2 rounded-full text-sm font-medium border transition-all flex items-center gap-1.5 ${
                showCustomTime
                  ? 'bg-primary/20 border-primary/50 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/30'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Pilih jam
            </button>
          </div>
          {showCustomTime && (
            <input
              type="datetime-local"
              value={eatenAt}
              onChange={e => setEatenAt(e.target.value)}
              className="mt-2 w-full bg-secondary border border-border rounded-xl px-3 py-2 text-base"
            />
          )}
          <p className="text-xs text-muted-foreground mt-1">Waktu: {displayTime}</p>
        </div>

        {/* Item input */}
        <div>
          <p className="text-sm font-medium mb-1.5">Makanan / Minuman</p>
          <p className="text-xs text-muted-foreground mb-2">Tulis per bahan: nasi, telur, udang</p>

          {/* Added items */}
          {items.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {items.map(item => (
                <span key={item} className="flex items-center gap-1 pl-3 pr-1.5 py-1.5 bg-primary/15 border border-primary/30 rounded-full text-sm font-medium text-primary">
                  {item}
                  <button onClick={() => removeItem(item)} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-primary/30 transition-colors" aria-label={`Hapus ${item}`}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="relative">
            <input
              ref={inputRef}
              placeholder="Ketik makanan lalu Enter atau koma..."
              value={itemInput}
              onChange={e => handleItemInput(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-base placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
            {showSuggestions && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                {suggestions.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addItem(s)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-primary/10 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {itemInput.trim() && (
            <button
              type="button"
              onClick={() => addItem(itemInput.trim())}
              className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-primary/40 text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
            >
              <Plus className="w-4 h-4" /> Tambah "{itemInput.trim()}"
            </button>
          )}
        </div>

        {/* Frequent items */}
        {frequentItems.length > 0 && items.length === 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Sering dimakan</p>
            <div className="flex flex-wrap gap-2">
              {frequentItems.filter(f => !items.includes(f)).map(f => (
                <button
                  key={f}
                  onClick={() => addItem(f)}
                  className="px-3 py-1.5 rounded-full border border-border text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-all"
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notes — collapsed by default */}
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
              placeholder='"warung seafood", "masakan ibu"...'
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-base placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none transition-colors"
            />
          </div>
        )}

        {/* Submit */}
        <div className="pb-safe pt-2">
          <Button
            onClick={handleSubmit}
            loading={loading}
            className="w-full h-14 text-base font-bold rounded-2xl glow-green"
          >
            <UtensilsCrossed className="w-5 h-5 mr-2" />
            Simpan Makan
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
