// Syntax-checks every migration and the seed with the real Postgres parser
// (libpg-query), including PL/pgSQL function bodies. No database needed —
// catches typos before `supabase db push`. Semantics are covered by `npm run test:db`.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import * as pg from "libpg-query";

if (pg.loadModule) await pg.loadModule();

const migrationsDir = "supabase/migrations";
const files = [
  ...readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join(migrationsDir, f)),
  "supabase/seed.sql",
];

let failed = false;
for (const file of files) {
  const sql = readFileSync(file, "utf8");
  try {
    await pg.parse(sql);
    if (/language\s+plpgsql/i.test(sql)) await pg.parsePlPgSQL(sql);
    console.log(`ok    ${file}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL  ${file}: ${error.message}`);
  }
}

process.exit(failed ? 1 : 0);
