'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ToastProps {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
  duration?: number
}

type ToastContextType = {
  toasts: ToastProps[]
  toast: (props: Omit<ToastProps, 'id'>) => void
  dismiss: (id: string) => void
}

const ToastContext = React.createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([])

  const toast = React.useCallback((props: Omit<ToastProps, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    const duration = props.duration ?? 3500
    setToasts(prev => [...prev, { ...props, id }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const dismiss = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function Toaster() {
  const [mounted, setMounted] = React.useState(false)
  const [toasts, setToasts] = React.useState<ToastProps[]>([])

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Simple standalone toaster using event system
  React.useEffect(() => {
    const handler = (e: CustomEvent<ToastProps>) => {
      setToasts(prev => [...prev, e.detail])
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== e.detail.id))
      }, e.detail.duration ?? 3500)
    }
    window.addEventListener('alergi-toast' as string, handler as EventListener)
    return () => window.removeEventListener('alergi-toast' as string, handler as EventListener)
  }, [])

  if (!mounted) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            'rounded-xl px-4 py-3 shadow-xl border animate-fade-in text-sm',
            t.variant === 'destructive'
              ? 'bg-red-950 border-red-800 text-red-100'
              : t.variant === 'success'
              ? 'bg-emerald-950 border-emerald-700 text-emerald-100'
              : 'glass text-foreground'
          )}
        >
          {t.title && <p className="font-semibold">{t.title}</p>}
          {t.description && <p className="opacity-80 mt-0.5">{t.description}</p>}
        </div>
      ))}
    </div>
  )
}

/** Utility: tampilkan toast dari mana saja */
export function showToast(props: Omit<ToastProps, 'id'>) {
  const id = Math.random().toString(36).slice(2)
  const event = new CustomEvent('alergi-toast', {
    detail: { ...props, id },
  })
  window.dispatchEvent(event)
}
