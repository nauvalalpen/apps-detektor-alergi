import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/app-layout'
import { TodayPage } from '@/components/pages/today-page'
import { getTodayWIB } from '@/lib/timezone'

export const instant = false

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = getTodayWIB()

  // Fetch today's data
  const [mealsRes, itchRes, medLogsRes, medsRes, dailyCtxRes] = await Promise.all([
    supabase
      .from('meals')
      .select('*, meal_items(*)')
      .eq('user_id', user.id)
      .gte('eaten_at', today + 'T00:00:00+07:00')
      .lt('eaten_at', today + 'T23:59:59+07:00')
      .order('eaten_at', { ascending: true }),
    supabase
      .from('itch_events')
      .select('*')
      .eq('user_id', user.id)
      .gte('started_at', today + 'T00:00:00+07:00')
      .lt('started_at', today + 'T23:59:59+07:00')
      .order('started_at', { ascending: true }),
    supabase
      .from('medication_logs')
      .select('*, medication:medications(*)')
      .eq('user_id', user.id)
      .gte('taken_at', today + 'T00:00:00+07:00')
      .lt('taken_at', today + 'T23:59:59+07:00')
      .order('taken_at', { ascending: true }),
    supabase
      .from('medications')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('kind'),
    supabase
      .from('daily_context')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle(),
  ])

  // Cek obat oral terakhir (untuk peringatan)
  const lastOralLog = await supabase
    .from('medication_logs')
    .select('*, medication:medications(*)')
    .eq('user_id', user.id)
    .order('taken_at', { ascending: false })
    .limit(10)

  return (
    <AppLayout user={user}>
      <TodayPage
        initialMeals={(mealsRes.data ?? []) as Parameters<typeof TodayPage>[0]['initialMeals']}
        initialItchEvents={itchRes.data ?? []}
        initialMedLogs={(medLogsRes.data ?? []) as Parameters<typeof TodayPage>[0]['initialMedLogs']}
        medications={medsRes.data ?? []}
        dailyContext={dailyCtxRes.data ?? null}
        allMedLogs={(lastOralLog.data ?? []) as Parameters<typeof TodayPage>[0]['allMedLogs']}
        today={today}
        userId={user.id}
      />
    </AppLayout>
  )
}
