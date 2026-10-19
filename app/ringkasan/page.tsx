// /ringkasan → permanently redirected to /riwayat
import { redirect } from 'next/navigation'

export default function Ringkasan() {
  redirect('/riwayat')
}
