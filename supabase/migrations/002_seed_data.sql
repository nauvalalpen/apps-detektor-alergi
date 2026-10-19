-- ============================================================
-- AlergiTrack - Seed Data (14 hari fiktif untuk uji analisis)
-- Hapus dengan: DELETE FROM meals; DELETE FROM itch_events; dst.
-- Atau gunakan tombol "Hapus Data Contoh" di Pengaturan
-- ============================================================

-- CATATAN: Seed ini perlu dijalankan setelah login & mendapat user_id.
-- Ganti '00000000-0000-0000-0000-000000000000' dengan user_id Anda.
-- Untuk keperluan testing, jalankan via Supabase SQL Editor dengan user yang sudah login.

-- Seed menggunakan fungsi untuk menghindari hardcode user_id:
DO $$
DECLARE
  v_user_id uuid;
  v_meal_id uuid;
  v_med_id_oral uuid;
  v_med_id_salep uuid;
  base_date date := current_date - interval '14 days';
BEGIN
  -- Ambil user pertama (hanya untuk seed, di prod pakai auth.uid())
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Tidak ada user ditemukan. Login dulu lalu jalankan seed.';
    RETURN;
  END IF;

  -- Buat obat-obatan
  INSERT INTO medications (user_id, name, kind, interval_hours, reminder_hour, active)
  VALUES 
    (v_user_id, 'Cetirizine 10mg', 'oral', 24, 20, true),
    (v_user_id, 'Salep Betametason', 'topical', 24, 21, true)
  RETURNING id INTO v_med_id_oral;
  
  SELECT id INTO v_med_id_oral FROM medications WHERE user_id = v_user_id AND kind = 'oral' LIMIT 1;
  SELECT id INTO v_med_id_salep FROM medications WHERE user_id = v_user_id AND kind = 'topical' LIMIT 1;

  -- ===== HARI 1 =====
  INSERT INTO daily_context (user_id, date, stress, sleep_hours, weather_notes, notes)
  VALUES (v_user_id, base_date + 0, 2, 7.5, 'panas', 'Hari biasa');
  
  -- Sarapan: nasi, telur, kecap
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 0 + time '07:30')::timestamptz, 'Sarapan') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi'), (v_meal_id, v_user_id, 'telur'), (v_meal_id, v_user_id, 'kecap');
  
  -- Makan siang: nasi, ayam goreng, tempe
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 0 + time '12:00')::timestamptz, 'Makan siang') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi'), (v_meal_id, v_user_id, 'ayam goreng'), (v_meal_id, v_user_id, 'tempe');
  
  -- Makan malam: nasi, udang, sayur
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 0 + time '19:00')::timestamptz, 'Makan malam - warung seafood') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi'), (v_meal_id, v_user_id, 'udang'), (v_meal_id, v_user_id, 'sayur kangkung');
  
  -- Gatal 3 jam setelah makan udang
  INSERT INTO itch_events (user_id, started_at, severity, body_areas, has_bumps, notes)
  VALUES (v_user_id, (base_date + 0 + time '22:00')::timestamptz, 6, ARRAY['tangan kiri', 'tangan kanan'], true, 'Gatal setelah makan udang');
  
  -- Obat diminum pagi
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_oral, (base_date + 0 + time '08:00')::timestamptz);
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_salep, (base_date + 0 + time '21:30')::timestamptz);

  -- ===== HARI 2 =====
  INSERT INTO daily_context (user_id, date, stress, sleep_hours, weather_notes, notes)
  VALUES (v_user_id, base_date + 1, 3, 6.0, 'hujan', 'Agak stres kerja');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 1 + time '08:00')::timestamptz, 'Sarapan') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'roti'), (v_meal_id, v_user_id, 'selai kacang'), (v_meal_id, v_user_id, 'susu');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 1 + time '13:00')::timestamptz, 'Makan siang') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi'), (v_meal_id, v_user_id, 'ikan bakar'), (v_meal_id, v_user_id, 'lalapan');
  
  -- Gatal 2 jam setelah makan siang - mungkin efek kacang
  INSERT INTO itch_events (user_id, started_at, severity, body_areas, has_bumps, notes)
  VALUES (v_user_id, (base_date + 1 + time '15:00')::timestamptz, 4, ARRAY['tangan kiri'], false, 'Gatal ringan sore hari');
  
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_oral, (base_date + 1 + time '20:00')::timestamptz);
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_salep, (base_date + 1 + time '21:00')::timestamptz);

  -- ===== HARI 3 =====
  INSERT INTO daily_context (user_id, date, stress, sleep_hours, weather_notes, notes)
  VALUES (v_user_id, base_date + 2, 2, 8.0, 'panas', 'Hari libur, santai');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 2 + time '09:00')::timestamptz, 'Sarapan') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi goreng'), (v_meal_id, v_user_id, 'telur'), (v_meal_id, v_user_id, 'kecap');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 2 + time '14:00')::timestamptz, 'Makan siang - mie ayam') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'mie'), (v_meal_id, v_user_id, 'ayam'), (v_meal_id, v_user_id, 'pangsit'), (v_meal_id, v_user_id, 'bawang goreng');
  
  -- Tidak ada gatal hari ini
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_oral, (base_date + 2 + time '20:00')::timestamptz);
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_salep, (base_date + 2 + time '22:00')::timestamptz);

  -- ===== HARI 4 =====
  INSERT INTO daily_context (user_id, date, stress, sleep_hours, weather_notes, notes)
  VALUES (v_user_id, base_date + 3, 3, 7.0, 'berkeringat banyak', 'Panas, banyak aktivitas');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 3 + time '07:00')::timestamptz, 'Sarapan') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi'), (v_meal_id, v_user_id, 'telur'), (v_meal_id, v_user_id, 'tahu');
  
  -- Makan siang: udang lagi
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 3 + time '12:30')::timestamptz, 'Makan siang - udang lagi') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi'), (v_meal_id, v_user_id, 'udang'), (v_meal_id, v_user_id, 'tempe');
  
  -- Gatal parah 4 jam setelah makan udang
  INSERT INTO itch_events (user_id, started_at, severity, body_areas, has_bumps, notes)
  VALUES (v_user_id, (base_date + 3 + time '16:30')::timestamptz, 8, ARRAY['tangan kiri', 'tangan kanan', 'kaki kiri'], true, 'Gatal parah, bentol banyak');
  
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_oral, (base_date + 3 + time '20:00')::timestamptz);
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_salep, (base_date + 3 + time '20:30')::timestamptz);

  -- ===== HARI 5 (obat TELAT - confounder test) =====
  INSERT INTO daily_context (user_id, date, stress, sleep_hours, weather_notes, notes)
  VALUES (v_user_id, base_date + 4, 4, 5.5, 'panas', 'Lupa minum obat kemarin malam');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 4 + time '08:00')::timestamptz, 'Sarapan') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi'), (v_meal_id, v_user_id, 'tempe'), (v_meal_id, v_user_id, 'tahu');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 4 + time '13:00')::timestamptz, 'Makan siang') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi'), (v_meal_id, v_user_id, 'ayam'), (v_meal_id, v_user_id, 'sayur bayam');
  
  -- Gatal 28 jam setelah obat terakhir (obat habis, bukan alergi makanan!)
  INSERT INTO itch_events (user_id, started_at, severity, body_areas, has_bumps, notes)
  VALUES (v_user_id, (base_date + 4 + time '23:00')::timestamptz, 9, ARRAY['tangan kiri', 'tangan kanan', 'kaki kiri', 'kaki kanan'], true, 'SANGAT PARAH - obat sudah 28 jam tidak diminum');
  
  -- Obat baru diminum malam ini (telat 4 jam dari jadwal 20:00)
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_oral, (base_date + 5 + time '00:00')::timestamptz);
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_salep, (base_date + 5 + time '00:30')::timestamptz);

  -- ===== HARI 6 =====
  INSERT INTO daily_context (user_id, date, stress, sleep_hours, weather_notes, notes)
  VALUES (v_user_id, base_date + 5, 2, 8.0, 'hujan', 'Sudah minum obat tepat waktu');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 5 + time '07:30')::timestamptz, 'Sarapan') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'bubur ayam'), (v_meal_id, v_user_id, 'kerupuk');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 5 + time '12:00')::timestamptz, 'Makan siang') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi'), (v_meal_id, v_user_id, 'tempe'), (v_meal_id, v_user_id, 'tahu'), (v_meal_id, v_user_id, 'sayur');
  
  -- Tidak ada gatal
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_oral, (base_date + 5 + time '20:00')::timestamptz);
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_salep, (base_date + 5 + time '21:00')::timestamptz);

  -- ===== HARI 7 =====
  INSERT INTO daily_context (user_id, date, stress, sleep_hours, weather_notes, notes)
  VALUES (v_user_id, base_date + 6, 3, 7.0, 'AC terus', 'Di kantor seharian');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 6 + time '08:00')::timestamptz, 'Sarapan') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'roti'), (v_meal_id, v_user_id, 'telur'), (v_meal_id, v_user_id, 'keju');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 6 + time '12:30')::timestamptz, 'Makan siang - gado-gado') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'sayur'), (v_meal_id, v_user_id, 'bumbu kacang'), (v_meal_id, v_user_id, 'tahu'), (v_meal_id, v_user_id, 'telur'), (v_meal_id, v_user_id, 'kerupuk');
  
  -- Gatal ringan setelah bumbu kacang (kedua kali)
  INSERT INTO itch_events (user_id, started_at, severity, body_areas, has_bumps, notes)
  VALUES (v_user_id, (base_date + 6 + time '14:00')::timestamptz, 3, ARRAY['tangan kiri'], false, 'Gatal ringan');
  
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_oral, (base_date + 6 + time '20:00')::timestamptz);
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_salep, (base_date + 6 + time '21:30')::timestamptz);

  -- ===== HARI 8 =====
  INSERT INTO daily_context (user_id, date, stress, sleep_hours, weather_notes, notes)
  VALUES (v_user_id, base_date + 7, 1, 9.0, 'hujan', 'Weekend santai');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 7 + time '09:00')::timestamptz, 'Sarapan') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi'), (v_meal_id, v_user_id, 'telur'), (v_meal_id, v_user_id, 'tahu');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 7 + time '13:00')::timestamptz, 'Makan siang') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi'), (v_meal_id, v_user_id, 'ayam'), (v_meal_id, v_user_id, 'tempe');
  
  -- Tidak ada gatal
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_oral, (base_date + 7 + time '19:00')::timestamptz);
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_salep, (base_date + 7 + time '21:00')::timestamptz);

  -- ===== HARI 9 =====
  INSERT INTO daily_context (user_id, date, stress, sleep_hours, weather_notes, notes)
  VALUES (v_user_id, base_date + 8, 2, 7.5, 'panas', 'Makan seafood lagi untuk uji');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 8 + time '07:30')::timestamptz, 'Sarapan') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi'), (v_meal_id, v_user_id, 'telur dadar');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 8 + time '18:00')::timestamptz, 'Makan malam - seafood') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi'), (v_meal_id, v_user_id, 'udang'), (v_meal_id, v_user_id, 'cumi'), (v_meal_id, v_user_id, 'sayur');
  
  -- Gatal 5 jam setelah makan seafood
  INSERT INTO itch_events (user_id, started_at, severity, body_areas, has_bumps, notes)
  VALUES (v_user_id, (base_date + 8 + time '23:00')::timestamptz, 7, ARRAY['tangan kiri', 'tangan kanan', 'kaki kanan'], true, 'Gatal parah setelah seafood');
  
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_oral, (base_date + 8 + time '20:00')::timestamptz);
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_salep, (base_date + 8 + time '21:00')::timestamptz);

  -- ===== HARI 10 =====
  INSERT INTO daily_context (user_id, date, stress, sleep_hours, weather_notes, notes)
  VALUES (v_user_id, base_date + 9, 4, 6.0, 'panas', 'Stres deadline');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 9 + time '08:00')::timestamptz, 'Sarapan') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi'), (v_meal_id, v_user_id, 'tempe'), (v_meal_id, v_user_id, 'sayur');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 9 + time '13:00')::timestamptz, 'Makan siang - soto') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi'), (v_meal_id, v_user_id, 'ayam'), (v_meal_id, v_user_id, 'telur'), (v_meal_id, v_user_id, 'soun');
  
  -- Tidak ada gatal
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_oral, (base_date + 9 + time '20:00')::timestamptz);
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_salep, (base_date + 9 + time '22:00')::timestamptz);

  -- ===== HARI 11 =====
  INSERT INTO daily_context (user_id, date, stress, sleep_hours, weather_notes, notes)
  VALUES (v_user_id, base_date + 10, 3, 7.0, 'panas', 'Sabtu');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 10 + time '09:00')::timestamptz, 'Sarapan') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'roti'), (v_meal_id, v_user_id, 'selai kacang'), (v_meal_id, v_user_id, 'susu');
  
  -- Gatal 2 jam setelah sarapan (bumbu kacang ketiga kali)
  INSERT INTO itch_events (user_id, started_at, severity, body_areas, has_bumps, notes)
  VALUES (v_user_id, (base_date + 10 + time '11:00')::timestamptz, 5, ARRAY['tangan kiri', 'kaki kiri'], true, 'Gatal setelah sarapan roti kacang');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 10 + time '13:00')::timestamptz, 'Makan siang') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi'), (v_meal_id, v_user_id, 'ayam'), (v_meal_id, v_user_id, 'tahu');
  
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_oral, (base_date + 10 + time '20:00')::timestamptz);
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_salep, (base_date + 10 + time '21:00')::timestamptz);

  -- ===== HARI 12 =====
  INSERT INTO daily_context (user_id, date, stress, sleep_hours, weather_notes, notes)
  VALUES (v_user_id, base_date + 11, 2, 8.0, 'hujan', 'Minggu istirahat');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 11 + time '09:00')::timestamptz, 'Sarapan') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi goreng'), (v_meal_id, v_user_id, 'telur'), (v_meal_id, v_user_id, 'ayam');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 11 + time '13:00')::timestamptz, 'Makan siang') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi'), (v_meal_id, v_user_id, 'ikan'), (v_meal_id, v_user_id, 'sayur');
  
  -- Tidak ada gatal
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_oral, (base_date + 11 + time '20:00')::timestamptz);
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_salep, (base_date + 11 + time '22:00')::timestamptz);

  -- ===== HARI 13 =====
  INSERT INTO daily_context (user_id, date, stress, sleep_hours, weather_notes, notes)
  VALUES (v_user_id, base_date + 12, 5, 5.0, 'panas', 'Sangat stres, deadline besok');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 12 + time '07:00')::timestamptz, 'Sarapan cepat') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'roti'), (v_meal_id, v_user_id, 'keju');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 12 + time '19:00')::timestamptz, 'Makan malam - udang goreng') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi'), (v_meal_id, v_user_id, 'udang'), (v_meal_id, v_user_id, 'sayur');
  
  -- Gatal berat - kombinasi stres + udang
  INSERT INTO itch_events (user_id, started_at, severity, body_areas, has_bumps, notes)
  VALUES (v_user_id, (base_date + 12 + time '21:00')::timestamptz, 8, ARRAY['tangan kiri', 'tangan kanan', 'kaki kiri', 'kaki kanan'], true, 'Sangat gatal, stres dan udang');
  
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_oral, (base_date + 12 + time '20:30')::timestamptz);
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_salep, (base_date + 12 + time '21:30')::timestamptz);

  -- ===== HARI 14 =====
  INSERT INTO daily_context (user_id, date, stress, sleep_hours, weather_notes, notes)
  VALUES (v_user_id, base_date + 13, 2, 8.0, 'hujan', 'Deadline selesai, lega');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 13 + time '08:00')::timestamptz, 'Sarapan') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi'), (v_meal_id, v_user_id, 'tempe'), (v_meal_id, v_user_id, 'tahu');
  
  INSERT INTO meals (user_id, eaten_at, notes) VALUES (v_user_id, (base_date + 13 + time '13:00')::timestamptz, 'Makan siang') RETURNING id INTO v_meal_id;
  INSERT INTO meal_items (meal_id, user_id, name) VALUES (v_meal_id, v_user_id, 'nasi'), (v_meal_id, v_user_id, 'ayam'), (v_meal_id, v_user_id, 'sayur bayam');
  
  -- Tidak ada gatal hari terakhir
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_oral, (base_date + 13 + time '20:00')::timestamptz);
  INSERT INTO medication_logs (user_id, medication_id, taken_at) VALUES (v_user_id, v_med_id_salep, (base_date + 13 + time '21:00')::timestamptz);

  RAISE NOTICE 'Seed data berhasil dimasukkan untuk user: %', v_user_id;
END;
$$;
