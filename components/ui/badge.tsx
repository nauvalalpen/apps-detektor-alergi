'use client'

import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'
  className?: string
  onRemove?: () => void
}

export function Badge({ children, variant = 'default', className, onRemove }: BadgeProps) {
  const variants = {
    default: 'bg-primary/20 text-primary border border-primary/30',
    success: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    danger: 'bg-red-500/20 text-red-300 border border-red-500/30',
    info: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
    muted: 'bg-muted text-muted-foreground border border-border',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 hover:opacity-60 transition-opacity rounded-full"
          type="button"
        >
          ×
        </button>
      )}
    </span>
  )
}

interface ProgressProps {
  value: number
  max?: number
  className?: string
  showLabel?: boolean
  color?: 'green' | 'yellow' | 'red' | 'auto'
}

export function Progress({ value, max = 100, className, showLabel, color = 'green' }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const colorClass =
    color === 'auto'
      ? pct < 40 ? 'bg-red-500' : pct < 70 ? 'bg-amber-500' : 'bg-emerald-500'
      : color === 'green' ? 'bg-primary' : color === 'yellow' ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="space-y-1">
      <div className={cn('h-2 rounded-full bg-border overflow-hidden', className)}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-muted-foreground text-right">{Math.round(pct)}%</p>
      )}
    </div>
  )
}

interface SliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
  label?: (v: number) => string
}

export function Slider({ value, onChange, min = 1, max = 10, step = 1, className, label }: SliderProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
      />
      {label && (
        <p className="text-center text-sm font-semibold text-primary">{label(value)}</p>
      )}
    </div>
  )
}
