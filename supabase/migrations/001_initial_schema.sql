-- ============================================================
-- AlergiTrack - Initial Schema
-- Jalankan file ini di Supabase SQL Editor
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABEL: meals (sesi makan)
-- ============================================================
CREATE TABLE IF NOT EXISTS meals (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  eaten_at    timestamptz NOT NULL DEFAULT now(),
  notes       text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meals_user_id_idx ON meals(user_id);
CREATE INDEX IF NOT EXISTS meals_eaten_at_idx ON meals(eaten_at);
CREATE INDEX IF NOT EXISTS meals_user_eaten_idx ON meals(user_id, eaten_at DESC);

ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meals: user owns rows" ON meals
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TABEL: meal_items (item per sesi makan)
-- ============================================================
CREATE TABLE IF NOT EXISTS meal_items (
  id        uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  meal_id   uuid REFERENCES meals(id) ON DELETE CASCADE NOT NULL,
  user_id   uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name      text NOT NULL CHECK (length(trim(name)) > 0),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meal_items_meal_id_idx ON meal_items(meal_id);
CREATE INDEX IF NOT EXISTS meal_items_user_id_idx ON meal_items(user_id);
CREATE INDEX IF NOT EXISTS meal_items_name_idx ON meal_items(name);
CREATE INDEX IF NOT EXISTS meal_items_user_name_idx ON meal_items(user_id, name);

ALTER TABLE meal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_items: user owns rows" ON meal_items
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TABEL: itch_events (episode gatal)
-- ============================================================
CREATE TABLE IF NOT EXISTS itch_events (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  severity    smallint CHECK (severity BETWEEN 1 AND 10),
  body_areas  text[] DEFAULT '{}',
  has_bumps   boolean DEFAULT false,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS itch_events_user_id_idx ON itch_events(user_id);
CREATE INDEX IF NOT EXISTS itch_events_started_at_idx ON itch_events(started_at);
CREATE INDEX IF NOT EXISTS itch_events_user_started_idx ON itch_events(user_id, started_at DESC);

ALTER TABLE itch_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "itch_events: user owns rows" ON itch_events
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TABEL: medications (daftar obat pengguna)
-- ============================================================
CREATE TABLE IF NOT EXISTS medications (
  id             uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id        uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name           text NOT NULL,
  kind           text NOT NULL CHECK (kind IN ('oral', 'topical')),
  interval_hours int DEFAULT 24 CHECK (interval_hours > 0),
  reminder_hour  int CHECK (reminder_hour BETWEEN 0 AND 23),
  active         boolean DEFAULT true,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS medications_user_id_idx ON medications(user_id);

ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medications: user owns rows" ON medications
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TABEL: medication_logs (log pemakaian obat)
-- ============================================================
CREATE TABLE IF NOT EXISTS medication_logs (
  id            uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  medication_id uuid REFERENCES medications(id) ON DELETE CASCADE NOT NULL,
  taken_at      timestamptz NOT NULL DEFAULT now(),
  notes         text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS medication_logs_user_id_idx ON medication_logs(user_id);
CREATE INDEX IF NOT EXISTS medication_logs_medication_id_idx ON medication_logs(medication_id);
CREATE INDEX IF NOT EXISTS medication_logs_taken_at_idx ON medication_logs(taken_at);
CREATE INDEX IF NOT EXISTS medication_logs_user_taken_idx ON medication_logs(user_id, taken_at DESC);

ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medication_logs: user owns rows" ON medication_logs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TABEL: daily_context (konteks harian)
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_context (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  date         date NOT NULL,
  stress       smallint CHECK (stress BETWEEN 1 AND 5),
  sleep_hours  numeric(4,1) CHECK (sleep_hours BETWEEN 0 AND 24),
  weather_notes text,
  new_products  text,
  notes         text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS daily_context_user_id_idx ON daily_context(user_id);
CREATE INDEX IF NOT EXISTS daily_context_date_idx ON daily_context(date);

ALTER TABLE daily_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_context: user owns rows" ON daily_context
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TABEL: analysis_cache (cache hasil analisis)
-- ============================================================
CREATE TABLE IF NOT EXISTS analysis_cache (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  cache_key   text NOT NULL,
  data        jsonb NOT NULL,
  computed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, cache_key)
);

CREATE INDEX IF NOT EXISTS analysis_cache_user_id_idx ON analysis_cache(user_id);

ALTER TABLE analysis_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analysis_cache: user owns rows" ON analysis_cache
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- FUNGSI: update updated_at otomatis
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_context_updated_at
  BEFORE UPDATE ON daily_context
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FUNGSI: normalize meal item name
-- ============================================================
CREATE OR REPLACE FUNCTION normalize_meal_item_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name = lower(trim(NEW.name));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER meal_items_normalize_name
  BEFORE INSERT OR UPDATE ON meal_items
  FOR EACH ROW EXECUTE FUNCTION normalize_meal_item_name();
