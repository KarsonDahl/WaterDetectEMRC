# Water Detect

An offline-first Android app for recording four-electrode ground resistivity
surveys in the field and computing apparent resistivity (ρa) as readings are
entered. It replaces pen-and-paper collection and manual transfer to Excel.

- **Works with no signal.** All data lives in SQLite on the phone.
- **Live results.** ρa and the sounding curve update as each value is typed,
  so bad readings are caught while the crew is still on site.
- **Export to CSV** through Android's share sheet (WhatsApp, email, Drive, USB).

Status: MVP, manual entry only. Raspberry Pi capture is planned (see Roadmap).

## Running it

Requires Node 20+.

```bash
npm install
npx expo start
```

- **On a phone:** install **Expo Go** from the Play Store, then scan the QR code
  from `npx expo start` (phone and computer on the same Wi-Fi). Everything the
  app uses is included in Expo Go, so no custom build is needed for development.
- **In a browser:** press `w`, or run `npm run web`. The web build is for quick
  UI checks only; the target is Android.

Checks to run before committing:

```bash
npm test            # unit tests for the math, units, spacing plans, CSV
npm run typecheck
npm run lint
```

## Building an installable app

Builds run on Expo's cloud service (EAS), so Android Studio isn't needed. You
need a free Expo account.

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview      # APK to sideload
npx eas-cli@latest build -p android --profile production   # AAB for the Play Store
```

The **preview APK** is the simplest way to get the app onto field phones: send
the file over USB, WhatsApp or Bluetooth and install it (Android asks to allow
installing from that source once).

For the **Play Store**, a personal developer account ($25 one-time) currently
has to run a closed test with at least 12 testers for 14 days before it can
publish to production. Organisation accounts are exempt but need a D-U-N-S
number.

Before the first store upload, confirm `android.package` in `app.json`
(currently `com.emrc.waterdetect`). It can never be changed once published.
Also replace the placeholder icons in `assets/images/`.

## How the numbers are calculated

The layout is `A ─── M ─── N ─── B`: A and B are the outer (current) stakes, M
and N the inner (potential) stakes. **AB** is the full outer span and **MN** the
inner span.

| Quantity | Formula |
|---|---|
| Geometric factor, Wenner | `K = π (AB² − MN²) / (4 · MN)` = `2πa` |
| Geometric factor, Schlumberger | `K = π ((AB/2) · 0.3048)²` (AB in feet) |
| Resistance, **Signed ±** method (default) | `R = \|V₁ − V₂\| / (\|I₁\| + \|I₂\|)` |
| Resistance, **Average** method | `R = (\|V₁\|/\|I₁\| + \|V₂\|/\|I₂\|) / 2` |
| Apparent resistivity | `ρa = K · R` (Ω·m) |
| Ground self-potential (Signed method) | `SP = V₁ − s·R·\|I₁\|`, where `s = sign(V₁ − V₂)` |
| Approx. depth of investigation | `0.173·AB` (Wenner), `0.19·AB` (Schlumberger), from Edwards (1977) |

One K formula covers both arrays: Wenner (AB = 3a) reduces to `2πa`.
Subscripts 1 and 2 are the two DPDT switch positions. The Signed method cancels
any steady ground voltage exactly, but only if each voltage is entered with the
sign the meter shows. Each survey can switch to the Average method if signs
weren't recorded.

The code is in [`src/lib/resistivity.ts`](src/lib/resistivity.ts). It is
pure TypeScript with no app dependencies, so it can be ported to the Pi.

**Charts.** Soundings plot ρa against spacing on log–log axes (AB/2 for
Schlumberger, a for Wenner). Profiles plot ρa against position along the line.

**Quality checks** shown on entry and exported in the `warnings` column:
Wenner layout not AB = 3·MN, Schlumberger MN > AB/5, zero current, reversed
reading missing, V₁/V₂ with the same sign (likely a missing minus), and
forward/reverse currents differing by more than 10%.

## Data model

```
survey    one setup: a sounding (fixed centre, widening stakes) or a profile (fixed spacing, moving along a line)
  id (uuid), name, mode, array_type, polarity_method,
  latitude, longitude, altitude_m, gps_accuracy_m, operator, notes,
  profile_inner_m, profile_outer_m, profile_step_m, created_at, updated_at

reading   one stake spacing and its two switch-position readings
  id (uuid), survey_id, seq, position_m, inner_m (MN), outer_m (AB),
  v1, i1, v2, i2, v_unit, i_unit, source ('manual' | 'pi'), note, created_at, updated_at
```

- The original sketch had a *location* table (inner and outer distances) and a
  *quality* table (voltages, amps, resistivity). Because every spacing gets
  exactly one set of readings, both are merged into `reading`. A real site
  record (`survey`, with GPS) was added.
- **Values are stored in SI units** (V, A, m). `v_unit` and `i_unit` record
  what the operator typed (mV or V, mA or A) so edits show the same numbers.
- **K, R and ρa are not stored.** They're computed from the raw readings, so
  fixing a formula or switching the polarity method re-derives every value.
  CSV exports include them.
- **UUIDs are generated on the phone**, so data from several phones can be
  merged later without ID collisions.
- **Migrations** live in [`src/db/migrations.ts`](src/db/migrations.ts).
  Never edit a migration that has shipped; add a new one.

## CSV export

One row per reading, with the survey's columns repeated on each row. Surveys
with no readings still get a row. The file is UTF-8 with a BOM so Excel opens
it correctly. Columns:

`survey_id, survey_name, mode, array_type, polarity_method, latitude, longitude, altitude_m, gps_accuracy_m, operator, survey_notes, survey_created_at, reading_id, seq, position_m, mn_m, ab_m, ab_half_m, v1_V, i1_A, v2_V, i2_A, entered_v_unit, entered_i_unit, k_m, resistance_ohm, rho_a_ohm_m, sp_V, approx_depth_m, reversed, warnings, reading_note, source, reading_created_at, reading_updated_at`

## Project layout

```
src/app/                 screens (Expo Router: each file is a route)
  index.tsx              survey list
  survey/new.tsx         new survey form
  survey/[id]/index.tsx  survey: curve + readings table
  survey/[id]/reading.tsx  reading entry (new or edit)
  survey/[id]/edit.tsx   edit or delete a survey
  help.tsx               in-app explanation of the formulas
src/lib/                 pure logic, unit-tested (resistivity, spacing plans, units, CSV)
src/db/                  SQLite schema, queries, live-query hook
src/features/            device features: GPS, file sharing, dialogs
src/components/          UI building blocks and the chart
```

## Open questions for the team

1. **Which voltage is recorded?** The app assumes V is measured across the
   inner stakes (M–N). If it's the stepped-up supply voltage, the formulas
   above don't apply.
2. **How were the two switch positions combined** in the existing Excel
   sheets? Either confirm the Signed method, or use Average for old data. Best
   check: enter a few historical readings and compare against Excel.
3. **Is "distance between outer electrodes" the full A–B span?** The app
   assumes so and labels it that way.

## Roadmap

- [x] Manual entry, live ρa, sounding and profile modes, CSV export
- [x] Live charts (originally phase 2, pulled forward)
- [ ] Guard against leaving a half-entered reading with the back button
- [ ] Full backup and restore (JSON), and import of historical Excel data
- [ ] Sync to a central database (e.g. Postgres) when online
- [ ] Raspberry Pi capture over Bluetooth or USB, written into the same
      `reading` table with `source = 'pi'`
- [ ] Translations (e.g. French or Swahili) if local operators need them
