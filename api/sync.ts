/**
 * POST /api/sync: one-way upload of a single survey (and its readings) from
 * the app into central Postgres. Idempotent: re-uploading the same survey
 * updates it in place. The app never waits on this; it is a deliberate button.
 *
 * Needs env var DATABASE_URL (Neon). Auth is a per-crew API key sent as
 * `Authorization: Bearer <key>`; only its SHA-256 hash is stored.
 */
import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

import { parseSyncPayload, SyncValidationError } from '../src/lib/sync-payload';

const MAX_BODY_BYTES = 1_000_000;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request): Promise<Response> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    return json({ error: 'Server is not configured.' }, 500);
  }

  const key = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!key) return json({ error: 'Missing API key.' }, 401);

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return json({ error: 'Upload too large.' }, 413);
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'Upload too large.' }, 413);

  let payload;
  try {
    payload = parseSyncPayload(JSON.parse(raw));
  } catch (e) {
    if (e instanceof SyncValidationError) return json({ error: e.message }, 400);
    if (e instanceof SyntaxError) return json({ error: 'Body is not valid JSON.' }, 400);
    throw e;
  }

  try {
    const sql = neon(databaseUrl);
    const keyHash = createHash('sha256').update(key).digest('hex');

    // Authenticate and record usage in one query. Revoked or unknown keys match nothing.
    const auth = await sql`
      UPDATE api_key SET last_used_at = now()
      WHERE key_hash = ${keyHash} AND revoked_at IS NULL
      RETURNING id`;
    if (auth.length === 0) return json({ error: 'Invalid API key.' }, 401);
    const apiKeyId = auth[0].id as string;

    // A survey belongs to the key that first uploaded it.
    const existing = await sql`SELECT api_key_id FROM survey WHERE id = ${payload.survey.id}`;
    if (existing.length > 0 && existing[0].api_key_id !== apiKeyId) {
      return json({ error: 'This survey was uploaded with a different API key.' }, 409);
    }

    const s = payload.survey;
    const readingIds = payload.readings.map((r) => r.id);
    await sql.transaction([
      sql`
        INSERT INTO survey (
          id, api_key_id, name, mode, array_type, polarity_method, latitude, longitude, altitude_m,
          gps_accuracy_m, operator, notes, profile_inner_m, profile_outer_m, profile_step_m,
          created_at, updated_at, synced_at)
        VALUES (
          ${s.id}, ${apiKeyId}, ${s.name}, ${s.mode}, ${s.arrayType}, ${s.polarityMethod}, ${s.latitude},
          ${s.longitude}, ${s.altitudeM}, ${s.gpsAccuracyM}, ${s.operator}, ${s.notes}, ${s.profileInnerM},
          ${s.profileOuterM}, ${s.profileStepM}, ${s.createdAt}, ${s.updatedAt}, now())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, mode = EXCLUDED.mode, array_type = EXCLUDED.array_type,
          polarity_method = EXCLUDED.polarity_method, latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude, altitude_m = EXCLUDED.altitude_m,
          gps_accuracy_m = EXCLUDED.gps_accuracy_m, operator = EXCLUDED.operator, notes = EXCLUDED.notes,
          profile_inner_m = EXCLUDED.profile_inner_m, profile_outer_m = EXCLUDED.profile_outer_m,
          profile_step_m = EXCLUDED.profile_step_m, updated_at = EXCLUDED.updated_at, synced_at = now()`,
      // The phone is the source of truth: readings deleted there disappear here too.
      sql`DELETE FROM reading WHERE survey_id = ${s.id} AND id <> ALL(${readingIds}::uuid[])`,
      sql`
        INSERT INTO reading (
          id, survey_id, seq, position_m, inner_m, outer_m, v1, i1, v2, i2,
          v_unit, i_unit, source, note, created_at, updated_at)
        SELECT x.id, x."surveyId", x.seq, x."positionM", x."innerM", x."outerM", x.v1, x.i1, x.v2, x.i2,
               x."vUnit", x."iUnit", x.source, x.note, x."createdAt", x."updatedAt"
        FROM jsonb_to_recordset(${JSON.stringify(payload.readings)}::jsonb) AS x(
          id uuid, "surveyId" uuid, seq integer, "positionM" double precision,
          "innerM" double precision, "outerM" double precision,
          v1 double precision, i1 double precision, v2 double precision, i2 double precision,
          "vUnit" text, "iUnit" text, source text, note text,
          "createdAt" timestamptz, "updatedAt" timestamptz)
        ON CONFLICT (id) DO UPDATE SET
          seq = EXCLUDED.seq, position_m = EXCLUDED.position_m, inner_m = EXCLUDED.inner_m,
          outer_m = EXCLUDED.outer_m, v1 = EXCLUDED.v1, i1 = EXCLUDED.i1, v2 = EXCLUDED.v2, i2 = EXCLUDED.i2,
          v_unit = EXCLUDED.v_unit, i_unit = EXCLUDED.i_unit, source = EXCLUDED.source, note = EXCLUDED.note,
          updated_at = EXCLUDED.updated_at
        WHERE reading.survey_id = EXCLUDED.survey_id`,
    ]);

    return json({ ok: true, surveyId: s.id, readings: payload.readings.length });
  } catch (e) {
    console.error('sync failed', e);
    return json({ error: 'Could not save the upload. Try again later.' }, 500);
  }
}
