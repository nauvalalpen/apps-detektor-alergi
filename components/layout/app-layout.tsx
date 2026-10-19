'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  Home, BarChart2, Calendar, Settings, Leaf, Moon, Sun
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState } from 'react'
import { showToast } from '@/components/ui/toaster'

/* 4 tab navigation — Analisis & Pantauan merged into Wawasan */
const navItems = [
  { href: '/',           icon: Home,     label: 'Hari Ini',   id: 'nav-today' },
  { href: '/ringkasan',  icon: Calendar, label: 'Riwayat',    id: 'nav-history' },
  { href: '/wawasan',    icon: BarChart2, label: 'Wawasan',   id: 'nav-insights' },
  { href: '/pengaturan', icon: Settings, label: 'Pengaturan', id: 'nav-settings' },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  // /wawasan catches old /analisis and /pantauan too
  if (href === '/wawasan') return pathname.startsWith('/wawasan') || pathname.startsWith('/analisis') || pathname.startsWith('/pantauan')
  return pathname.startsWith(href)
}

export function AppLayout({ children, user }: { children: React.ReactNode; user: User }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const supabase = createClient()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    showToast({ title: 'Berhasil keluar', variant: 'default' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card sticky top-0 h-screen shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
          <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <Leaf className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-base gradient-text">AlergiTrack</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Navigasi utama">
          {navItems.map(item => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                id={item.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all',
                  active
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {item.label}
                {active && <span className="ml-auto w-1.5 h-5 rounded-full bg-primary" />}
              </Link>
            )
          })}
        </nav>

        {/* Bottom: theme + user */}
        <div className="px-3 pb-4 space-y-2 border-t border-border pt-3">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-3 px-3 py-2 rounded-xl w-full text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
            aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          </button>
          <div className="px-3 py-1">
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border glass sticky top-0 z-40 shrink-0">
          <Link href="/" className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-primary" />
            <span className="font-bold text-base gradient-text">AlergiTrack</span>
          </Link>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
            aria-label={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </header>

        {/* Content — padded for bottom nav on mobile */}
        <main className="flex-1 pb-24 md:pb-8">
          <div className="max-w-2xl mx-auto w-full">
            {children}
          </div>
        </main>

        {/* ── Mobile bottom tab bar ── */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-border bottom-nav"
          aria-label="Tab navigasi"
        >
          <div className="flex items-center justify-around px-2 h-16">
            {navItems.map(item => {
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  id={item.id}
                  aria-current={active ? 'page' : undefined}
                  className="flex flex-col items-center justify-center gap-1 px-3 py-2 min-w-[64px] min-h-[48px] rounded-xl transition-all"
                >
                  <div className={cn(
                    'relative flex items-center justify-center w-10 h-7 rounded-full transition-all',
                    active ? 'bg-primary/20' : ''
                  )}>
                    <item.icon className={cn(
                      'w-5 h-5 transition-colors',
                      active ? 'text-primary' : 'text-muted-foreground'
                    )} />
                    {active && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className={cn(
                    'leading-none font-medium transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground'
                  )}
                  style={{ fontSize: '11px' }}
                  >
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
