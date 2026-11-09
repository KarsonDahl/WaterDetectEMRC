import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Schema migrations, applied in order on app start. `PRAGMA user_version`
 * records how many have run. Never edit a shipped migration — phones in the
 * field may already have run it. Append a new one instead.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE survey (
    id               TEXT PRIMARY KEY NOT NULL,
    name             TEXT NOT NULL,
    mode             TEXT NOT NULL CHECK (mode IN ('sounding', 'profile')),
    array_type       TEXT NOT NULL CHECK (array_type IN ('wenner', 'schlumberger')),
    polarity_method  TEXT NOT NULL DEFAULT 'reversal' CHECK (polarity_method IN ('reversal', 'average')),
    latitude         REAL,
    longitude        REAL,
    altitude_m       REAL,
    gps_accuracy_m   REAL,
    operator         TEXT NOT NULL DEFAULT '',
    notes            TEXT NOT NULL DEFAULT '',
    profile_inner_m  REAL,
    profile_outer_m  REAL,
    profile_step_m   REAL,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
  );

  CREATE TABLE reading (
    id          TEXT PRIMARY KEY NOT NULL,
    survey_id   TEXT NOT NULL REFERENCES survey(id) ON DELETE CASCADE,
    seq         INTEGER NOT NULL,
    position_m  REAL,
    inner_m     REAL NOT NULL,
    outer_m     REAL NOT NULL,
    v1          REAL,
    i1          REAL,
    v2          REAL,
    i2          REAL,
    v_unit      TEXT NOT NULL DEFAULT 'mV' CHECK (v_unit IN ('V', 'mV')),
    i_unit      TEXT NOT NULL DEFAULT 'mA' CHECK (i_unit IN ('A', 'mA')),
    source      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'pi')),
    note        TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE INDEX reading_survey_seq ON reading (survey_id, seq);
  `,
  // 2: per-survey distance unit for entry/display (values stay stored in metres).
  `ALTER TABLE survey ADD COLUMN length_unit TEXT NOT NULL DEFAULT 'm' CHECK (length_unit IN ('m', 'ft'));`,
];

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  // Connection-level settings: must run on every open, not just once.
  await db.execAsync(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let version = current; version < MIGRATIONS.length; version++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
