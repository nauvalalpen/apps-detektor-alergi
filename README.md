# AlergiTrack 🌿

Aplikasi web jurnal alergi harian untuk penderita eksim. Catat makanan, gatal, dan obat — temukan kemungkinan pemicu dari data Anda sendiri.

> ⚠️ Semua hasil analisis adalah **indikasi dari data pribadi, bukan diagnosis medis**. Selalu konsultasikan dengan dokter.

---

## Fitur

| Halaman | Deskripsi |
|---------|-----------|
| **Hari Ini** | Catat makan, gatal, obat via 3 tombol besar. Timeline real-time. |
| **Ringkasan** | Kalender bulanan per keparahan + detail per tanggal |
| **Analisis** | Lift score per item-jendela waktu, konfounder obat terdisolasi |
| **Pantauan** | Grafik Recharts 30 hari, live update Supabase Realtime |
| **Pengaturan** | Kelola obat, ekspor HTML/CSV untuk dokter |

### Fitur Utama
- **Jendela waktu**: 0-2 jam, 2-6 jam, 6-24 jam, 24-48 jam setelah makan
- **Konfounder obat**: Episode gatal saat obat oral sudah melampaui interval *dikecualikan otomatis* dari analisis makanan (bisa di-toggle)
- **Lift score**: Mengukur seberapa jauh item makanan tertentu melebihi baseline
- **Progressive Web App**: Installable, shortcut ke "Catat Gatal" & "Catat Makan"
- **Dark mode default**, tema hijau hutan, glassmorphism

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Backend | Supabase (Postgres + Auth + RLS + Realtime) |
| Charts | Recharts |
| Date utils | date-fns + date-fns-tz |
| Deploy | Vercel |

---

## Setup & Development

### 1. Prasyarat
- Node.js ≥ 20
- Akun [Supabase](https://supabase.com) (free tier cukup)
- Akun [Vercel](https://vercel.com) (untuk deploy)

### 2. Clone & Install

```bash
git clone https://github.com/USERNAME/apps-detektor-alergi.git
cd apps-detektor-alergi
npm install
```

### 3. Setup Supabase

1. Buat project baru di Supabase
2. Buka **SQL Editor** → jalankan isi `supabase/migrations/001_initial_schema.sql`
3. *(Opsional)* Jalankan `supabase/migrations/002_seed_data.sql` untuk data contoh 14 hari
   - ⚠️ Ganti `'00000000-0000-0000-0000-000000000001'` dengan UUID user Anda setelah mendaftar

### 4. Environment Variables

Salin `.env.example` ke `.env.local`:

```bash
cp .env.example .env.local
```

Isi dengan kredensial dari Supabase > Settings > API:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
NEXT_PUBLIC_ALLOW_SIGNUP=true
```

### 5. Jalankan Lokal

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

---

## Deploy ke Vercel

```bash
npx vercel --prod
```

Tambahkan environment variables yang sama di dashboard Vercel > Project > Settings > Environment Variables.

---

## Database Schema

```
meals
  id, user_id, eaten_at (timestamptz), notes

meal_items
  id, meal_id, user_id, name (normalized lowercase)

itch_events
  id, user_id, started_at, severity (1-10), body_areas (text[]),
  has_bumps, notes

medications
  id, user_id, name, kind (oral|topical), interval_hours,
  reminder_hour, active

medication_logs
  id, user_id, medication_id, taken_at, notes

daily_context
  id, user_id, date (unique), stress (1-5), sleep_hours,
  weather_notes, new_products, notes
```

Semua tabel dilindungi **Row Level Security** — data hanya bisa diakses oleh `auth.uid() = user_id`.

---

## Logika Analisis

File: `lib/analysis.ts`

### Lift Score
```
lift = P(itch | item) / P(itch | any meal)
     = (followedByItch / exposed) / (totalItchAfterMeals / totalExposures)
```
- `lift > 1` → item lebih sering diikuti gatal dari rata-rata
- `lift ≥ 1.8` → "Kemungkinan Tinggi"
- `lift ≥ 1.2` → "Kemungkinan Sedang"
- `n < 3` → "Data Belum Cukup"

### Konfounder Obat Habis
Episode gatal diklasifikasikan sebagai **depletion episode** jika:
```
jam_sejak_obat_oral_terakhir > interval_obat + 1 jam
```
Episode ini **dikecualikan** dari analisis makanan secara default (bisa diikutsertakan via toggle di halaman Analisis).

### Jendela Waktu
| Window | Relevansi Klinis |
|--------|-----------------|
| 0–2 jam | Reaksi cepat (IgE-mediated) |
| 2–6 jam | Reaksi tipe lambat umum |
| 6–24 jam | Reaksi delayed / eksim |
| 24–48 jam | Reaksi sangat lambat |

---

## Keputusan Desain

1. **Tidak ada AI/LLM di v1** — statistik sederhana lebih transparan dan dapat dijelaskan ke dokter
2. **Timezone WIB (Asia/Jakarta) hardcoded** — karena pengguna tunggal berbasis di Indonesia
3. **Lift, bukan korelasi Pearson** — lebih intuitif untuk data biner (makan/tidak) vs biner (gatal/tidak)
4. **Konfounder obat habis wajib dicatat** — karena dokter pengguna sudah mengidentifikasi ini sebagai variabel pengganggu utama
5. **Satu user per instance** — tidak ada fitur multi-user; RLS memastikan isolasi data

---

## Unit Tests

```bash
npx ts-node --project tsconfig.json lib/analysis.test.ts
```

Tests: depletion detection, lift calculation, depletion exclusion logic.

---

## Roadmap (v2)

- [ ] Push notification via Service Worker untuk pengingat obat
- [ ] Uji eliminasi terpandu (elimination diet tracker)
- [ ] Ekspor PDF via puppeteer
- [ ] Sync ke kalender Google
- [ ] Mode offline dengan IndexedDB

---

*Dibuat dengan ❤️ untuk membantu penderita eksim menemukan pemicunya sendiri.*
