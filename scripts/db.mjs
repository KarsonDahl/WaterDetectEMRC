// Admin helper for the central Postgres. Run with DATABASE_URL set:
//   node scripts/db.mjs setup                 create tables (safe to re-run)
//   node scripts/db.mjs create-key "Crew A"   make an API key (shown once)
//   node scripts/db.mjs list-keys
//   node scripts/db.mjs revoke-key "Crew A"
import { neon } from '@neondatabase/serverless';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL first (the Neon connection string).');
  process.exit(1);
}
const sql = neon(url);
const [command, label] = process.argv.slice(2);

if (command === 'setup') {
  const schema = readFileSync(new URL('../server/schema.sql', import.meta.url), 'utf8');
  const statements = schema
    .split(/;[ \t]*(?:\r?\n|$)/)
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean);
  for (const statement of statements) await sql.query(statement);
  console.log(`Applied ${statements.length} statements.`);
} else if (command === 'create-key') {
  if (!label) throw new Error('Give the key a label, e.g. create-key "Crew A"');
  const key = `wd_${randomBytes(32).toString('base64url')}`;
  const hash = createHash('sha256').update(key).digest('hex');
  await sql`INSERT INTO api_key (label, key_hash) VALUES (${label}, ${hash})`;
  console.log(`API key for "${label}" (shown once, only its hash is stored):\n\n  ${key}\n`);
} else if (command === 'list-keys') {
  console.table(await sql`SELECT label, created_at, last_used_at, revoked_at FROM api_key ORDER BY created_at`);
} else if (command === 'revoke-key') {
  if (!label) throw new Error('Say which label to revoke.');
  const rows = await sql`UPDATE api_key SET revoked_at = now() WHERE label = ${label} AND revoked_at IS NULL RETURNING id`;
  console.log(`Revoked ${rows.length} key(s) labelled "${label}".`);
} else {
  console.error('Commands: setup | create-key <label> | list-keys | revoke-key <label>');
  process.exit(1);
}
