// /pantauan → permanently redirected to /wawasan
import { redirect } from 'next/navigation'

export default function Pantauan() {
  redirect('/wawasan')
}
