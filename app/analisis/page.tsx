// /analisis → permanently redirected to /wawasan
import { redirect } from 'next/navigation'

export default function Analisis() {
  redirect('/wawasan')
}
