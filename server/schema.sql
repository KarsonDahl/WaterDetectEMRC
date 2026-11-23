-- Central Postgres schema for uploaded surveys. Mirrors the phone's SQLite
-- tables (raw SI readings; K, R and rho_a are derived, never stored).
-- scripts/db.mjs runs these statements one at a time, split on ";" at end of line.

CREATE TABLE IF NOT EXISTS api_key (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label        text NOT NULL,
  key_hash     text NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

CREATE TABLE IF NOT EXISTS survey (
  id               uuid PRIMARY KEY,
  api_key_id       uuid NOT NULL REFERENCES api_key (id),
  name             text NOT NULL,
  mode             text NOT NULL CHECK (mode IN ('sounding', 'profile')),
  array_type       text NOT NULL CHECK (array_type IN ('wenner', 'schlumberger')),
  polarity_method  text NOT NULL CHECK (polarity_method IN ('reversal', 'average')),
  latitude         double precision,
  longitude        double precision,
  altitude_m       double precision,
  gps_accuracy_m   double precision,
  operator         text NOT NULL DEFAULT '',
  notes            text NOT NULL DEFAULT '',
  profile_inner_m  double precision,
  profile_outer_m  double precision,
  profile_step_m   double precision,
  created_at       timestamptz NOT NULL,
  updated_at       timestamptz NOT NULL,
  synced_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reading (
  id          uuid PRIMARY KEY,
  survey_id   uuid NOT NULL REFERENCES survey (id) ON DELETE CASCADE,
  seq         integer NOT NULL,
  position_m  double precision,
  inner_m     double precision NOT NULL,
  outer_m     double precision NOT NULL,
  v1          double precision,
  i1          double precision,
  v2          double precision,
  i2          double precision,
  v_unit      text NOT NULL CHECK (v_unit IN ('V', 'mV')),
  i_unit      text NOT NULL CHECK (i_unit IN ('A', 'mA')),
  source      text NOT NULL CHECK (source IN ('manual', 'pi')),
  note        text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS reading_survey_seq ON reading (survey_id, seq);
