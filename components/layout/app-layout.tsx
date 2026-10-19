'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  Home, BarChart2, Calendar, Settings, Activity, LogOut, Leaf, Moon, Sun
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState } from 'react'
import { showToast } from '@/components/ui/toaster'

const navItems = [
  { href: '/', icon: Home, label: 'Hari Ini' },
  { href: '/ringkasan', icon: Calendar, label: 'Ringkasan' },
  { href: '/analisis', icon: BarChart2, label: 'Analisis' },
  { href: '/pantauan', icon: Activity, label: 'Pantauan' },
  { href: '/pengaturan', icon: Settings, label: 'Pengaturan' },
]

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
    <div className="min-h-screen flex flex-col">
      {/* Top bar - hanya untuk desktop/tablet */}
      <header className="hidden md:flex items-center justify-between px-6 py-4 border-b border-border/50 glass sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Leaf className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold gradient-text">AlergiTrack</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all',
                pathname === item.href
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <span className="text-xs text-muted-foreground">{user.email}</span>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="p-2 rounded-xl text-muted-foreground hover:text-red-400 hover:bg-red-950/30 transition-all"
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border/50 glass sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2">
          <Leaf className="w-5 h-5 text-primary" />
          <span className="font-bold text-sm gradient-text">AlergiTrack</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl text-muted-foreground"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="p-2 rounded-xl text-muted-foreground hover:text-red-400 transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>

      {/* Bottom nav - mobile only */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-border/50 bottom-nav">
        <div className="flex items-center justify-around py-2 px-2">
          {navItems.map(item => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-0',
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div className={cn(
                  'p-1.5 rounded-xl transition-all',
                  active && 'bg-primary/20'
                )}>
                  <item.icon className={cn('w-5 h-5', active && 'drop-shadow-[0_0_6px_rgba(74,222,128,0.6)]')} />
                </div>
                <span className="text-[10px] font-medium leading-none truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
