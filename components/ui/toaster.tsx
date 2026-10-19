'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, Info, Undo2 } from 'lucide-react'

export interface ToastProps {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
  duration?: number
  action?: { label: string; onClick: () => void }
}

/* ── Event bus toast system ── */
export function showToast(props: Omit<ToastProps, 'id'>) {
  const id = Math.random().toString(36).slice(2)
  window.dispatchEvent(new CustomEvent('alergi-toast', { detail: { ...props, id } }))
}

export function Toaster() {
  const [mounted, setMounted] = React.useState(false)
  const [toasts, setToasts] = React.useState<ToastProps[]>([])

  React.useEffect(() => { setMounted(true) }, [])

  React.useEffect(() => {
    function handler(e: CustomEvent<ToastProps>) {
      const detail = e.detail
      setToasts(prev => [...prev, detail])
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== detail.id))
      }, detail.duration ?? 4000)
    }
    window.addEventListener('alergi-toast' as string, handler as EventListener)
    return () => window.removeEventListener('alergi-toast' as string, handler as EventListener)
  }, [])

  if (!mounted) return null

  return (
    <div
      aria-live="polite"
      aria-label="Notifikasi"
      className="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] md:bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-[calc(100vw-2rem)] w-80"
    >
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
      ))}
    </div>
  )
}

function ToastItem({ toast: t, onDismiss }: { toast: ToastProps; onDismiss: () => void }) {
  const Icon =
    t.variant === 'destructive' ? XCircle
    : t.variant === 'success' ? CheckCircle2
    : Info

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl px-4 py-3 shadow-xl border text-sm animate-slide-up',
        t.variant === 'destructive'
          ? 'bg-red-950 border-red-800/60 text-red-100'
          : t.variant === 'success'
          ? 'bg-emerald-950 border-emerald-700/60 text-emerald-100'
          : 'glass text-foreground'
      )}
      role="status"
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5 opacity-80" />
      <div className="flex-1 min-w-0">
        {t.title && <p className="font-semibold leading-snug">{t.title}</p>}
        {t.description && <p className="opacity-75 text-sm mt-0.5 leading-snug">{t.description}</p>}
        {t.action && (
          <button
            onClick={() => { t.action!.onClick(); onDismiss() }}
            className="mt-1.5 text-sm font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity flex items-center gap-1"
          >
            <Undo2 className="w-3.5 h-3.5" />
            {t.action.label}
          </button>
        )}
      </div>
    </div>
  )
}
