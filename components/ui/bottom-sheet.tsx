'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  /** Height variant — 'auto' grows with content, 'full' = 85dvh */
  height?: 'auto' | 'full'
  className?: string
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  height = 'auto',
  className,
}: BottomSheetProps) {
  const sheetRef = React.useRef<HTMLDivElement>(null)

  // Close on Esc
  React.useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Trap focus
  React.useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement
    sheetRef.current?.focus()
    return () => prev?.focus()
  }, [open])

  // Lock body scroll
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="sheet-backdrop animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Panel'}
        tabIndex={-1}
        className={cn(
          'fixed bottom-0 inset-x-0 z-[60] rounded-t-2xl bg-card border-t border-border shadow-2xl animate-slide-up',
          'flex flex-col outline-none',
          'max-h-[92dvh]',
          height === 'full' && 'h-[85dvh]',
          className
        )}
      >
        {/* Handle */}
        <div className="flex-shrink-0 flex items-center justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </>
  )
}
