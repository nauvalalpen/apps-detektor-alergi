export const instant = false

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/app-layout'
import { PengaturanPage } from '@/components/pages/pengaturan-page'

export default async function Pengaturan() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const medsRes = await supabase
    .from('medications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at')

  // Bug #4: detect if seed/demo data exists (meals with notes containing "contoh" or "demo")
  const seedCheck = await supabase
    .from('meals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .ilike('notes', '%contoh%')

  const hasSeedData = (seedCheck.count ?? 0) > 0

  return (
    <AppLayout user={user}>
      <PengaturanPage
        medications={medsRes.data ?? []}
        userId={user.id}
        userEmail={user.email ?? ''}
        hasSeedData={hasSeedData}
      />
    </AppLayout>
  )
}
