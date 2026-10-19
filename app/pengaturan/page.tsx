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

  return (
    <AppLayout user={user}>
      <PengaturanPage
        medications={medsRes.data ?? []}
        userId={user.id}
        userEmail={user.email ?? ''}
      />
    </AppLayout>
  )
}
