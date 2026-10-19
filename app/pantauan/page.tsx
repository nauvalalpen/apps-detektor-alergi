export const instant = false

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/app-layout'
import { PantauanPage } from '@/components/pages/pantauan-page'

export default async function Pantauan() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

  const [mealsRes, itchRes, medLogsRes, medsRes] = await Promise.all([
    supabase
      .from('meals')
      .select('*, meal_items(*)')
      .eq('user_id', user.id)
      .order('eaten_at', { ascending: true }),
    supabase
      .from('itch_events')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: true }),
    supabase
      .from('medication_logs')
      .select('*, medication:medications(*)')
      .eq('user_id', user.id)
      .order('taken_at', { ascending: true }),
    supabase.from('medications').select('*').eq('user_id', user.id),
  ])

  return (
    <AppLayout user={user}>
      <PantauanPage
        meals={(mealsRes.data ?? []) as Parameters<typeof PantauanPage>[0]['meals']}
        itchEvents={itchRes.data ?? []}
        medLogs={(medLogsRes.data ?? []) as Parameters<typeof PantauanPage>[0]['medLogs']}
        medications={medsRes.data ?? []}
        userId={user.id}
      />
    </AppLayout>
  )
}
