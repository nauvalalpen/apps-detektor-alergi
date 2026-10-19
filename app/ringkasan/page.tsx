export const instant = false

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/app-layout'
import { RingkasanPage } from '@/components/pages/ringkasan-page'
import { getTodayWIB } from '@/lib/timezone'

export default async function Ringkasan() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = getTodayWIB()

  // Fetch 60 hari terakhir
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  const [mealsRes, itchRes, medLogsRes, medsRes, contextRes] = await Promise.all([
    supabase
      .from('meals')
      .select('*, meal_items(*)')
      .eq('user_id', user.id)
      .gte('eaten_at', sixtyDaysAgo.toISOString())
      .order('eaten_at', { ascending: false }),
    supabase
      .from('itch_events')
      .select('*')
      .eq('user_id', user.id)
      .gte('started_at', sixtyDaysAgo.toISOString())
      .order('started_at', { ascending: false }),
    supabase
      .from('medication_logs')
      .select('*, medication:medications(*)')
      .eq('user_id', user.id)
      .gte('taken_at', sixtyDaysAgo.toISOString())
      .order('taken_at', { ascending: false }),
    supabase.from('medications').select('*').eq('user_id', user.id),
    supabase
      .from('daily_context')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', sixtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false }),
  ])

  return (
    <AppLayout user={user}>
      <RingkasanPage
        meals={(mealsRes.data ?? []) as Parameters<typeof RingkasanPage>[0]['meals']}
        itchEvents={itchRes.data ?? []}
        medLogs={(medLogsRes.data ?? []) as Parameters<typeof RingkasanPage>[0]['medLogs']}
        medications={medsRes.data ?? []}
        dailyContexts={contextRes.data ?? []}
        today={today}
        userId={user.id}
      />
    </AppLayout>
  )
}
