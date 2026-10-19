'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { showToast } from '@/components/ui/toaster'
import { getNowLocalISO, localToUTC } from '@/lib/timezone'
import { normalizeItem } from '@/lib/utils'
import { UtensilsCrossed, Plus, X } from 'lucide-react'
import type { MealWithItems } from '@/lib/database.types'

interface MealFormProps {
  open: boolean
  onClose: () => void
  userId: string
  editData?: MealWithItems | null
  onSave: (meal: MealWithItems) => void
  knownItems: string[]
}

export function MealForm({ open, onClose, userId, editData, onSave, knownItems }: MealFormProps) {
  const [eatenAt, setEatenAt] = useState(getNowLocalISO())
  const [items, setItems] = useState<string[]>([])
  const [itemInput, setItemInput] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      if (editData) {
        setEatenAt(editData.eaten_at.replace('Z', '').slice(0, 16).replace('T', 'T'))
        // Convert UTC back to local for display
        const utcDate = new Date(editData.eaten_at)
        const localISO = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000)
          .toISOString().slice(0, 16)
        setEatenAt(localISO)
        setItems(editData.meal_items.map(i => i.name))
        setNotes(editData.notes ?? '')
      } else {
        setEatenAt(getNowLocalISO())
        setItems([])
        setNotes('')
      }
      setItemInput('')
    }
  }, [open, editData])

  function handleItemInput(val: string) {
    setItemInput(val)
    if (val.trim().length >= 1) {
      const norm = normalizeItem(val)
      const filtered = knownItems
        .filter(k => k.includes(norm) && !items.includes(k))
        .slice(0, 6)
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }

  function addItem(name: string) {
    const norm = normalizeItem(name)
    if (norm && !items.includes(norm)) {
      setItems(prev => [...prev, norm])
    }
    setItemInput('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  function removeItem(name: string) {
    setItems(prev => prev.filter(i => i !== name))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (itemInput.trim()) addItem(itemInput.trim())
    }
    if (e.key === 'Escape') setShowSuggestions(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.length === 0) {
      showToast({ title: 'Tambah minimal 1 item makanan', variant: 'destructive' })
      return
    }
    setLoading(true)

    try {
      const eatenAtUTC = localToUTC(eatenAt)

      if (editData) {
        // Update meal
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('meals') as any).update({
          eaten_at: eatenAtUTC,
          notes: notes || null,
        }).eq('id', editData.id)

        // Replace meal items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('meal_items') as any).delete().eq('meal_id', editData.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('meal_items') as any).insert(
          items.map(name => ({ meal_id: editData.id, user_id: userId, name }))
        )

        showToast({ title: 'Entri makan diperbarui', variant: 'success' })
        onSave({
          ...editData,
          eaten_at: eatenAtUTC,
          notes: notes || null,
          meal_items: items.map(name => ({ id: '', meal_id: editData.id, user_id: userId, name, created_at: '' }))
        })
      } else {
        // Insert new meal
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: meal, error: mealErr } = await (supabase.from('meals') as any)
          .insert({ user_id: userId, eaten_at: eatenAtUTC, notes: notes || null })
          .select()
          .single()

        if (mealErr || !meal) throw mealErr ?? new Error('Gagal menyimpan')

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: mealItems } = await (supabase.from('meal_items') as any)
          .insert(items.map((name: string) => ({ meal_id: meal.id, user_id: userId, name })))
          .select()

        showToast({ title: 'Makan berhasil dicatat!', variant: 'success' })
        onSave({ ...meal, meal_items: mealItems ?? [] })
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-primary" />
            {editData ? 'Edit Makan' : 'Catat Makan'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="meal-time">Waktu Makan</Label>
            <Input
              id="meal-time"
              type="datetime-local"
              value={eatenAt}
              onChange={e => setEatenAt(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meal-items">Makanan / Minuman</Label>
            <p className="text-xs text-muted-foreground">
              Ketik item lalu tekan Enter. Pecah per bahan: "nasi", "udang", "telur"
            </p>

            {items.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {items.map(item => (
                  <Badge key={item} variant="default" onRemove={() => removeItem(item)}>
                    {item}
                  </Badge>
                ))}
              </div>
            )}

            <div className="relative">
              <Input
                id="meal-items"
                ref={inputRef}
                placeholder="Ketik makanan lalu Enter..."
                value={itemInput}
                onChange={e => handleItemInput(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="off"
              />
              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-1 glass rounded-xl border border-border shadow-xl z-50 overflow-hidden">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addItem(s)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {itemInput.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addItem(itemInput.trim())}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-1" />
                Tambah "{itemInput.trim()}"
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meal-notes">Catatan (opsional)</Label>
            <Textarea
              id="meal-notes"
              placeholder='Misal: "warung seafood", "masakan ibu"'
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
