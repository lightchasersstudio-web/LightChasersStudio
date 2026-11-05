// One-time go-live helper: copies the studio's setup from the dev project to a
// new, empty production project. Never copies bookings, payments or clients.
//
//   SOURCE_SUPABASE_URL=… SOURCE_SERVICE_ROLE_KEY=… \
//   TARGET_SUPABASE_URL=… TARGET_SERVICE_ROLE_KEY=… \
//   node scripts/copy-catalog.mjs [--dry-run]
//
// Copies: business settings, packages, add-ons, opening hours, upcoming days off,
// portfolio photos and reviews, plus their image files (portfolio + brand buckets).
// Run `npm run db:push` against the target first so it has the same tables.
import { createClient } from "@supabase/supabase-js";

const env = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}.`);
    process.exit(1);
  }
  return v;
};
const opts = { auth: { persistSession: false } };
const source = createClient(env("SOURCE_SUPABASE_URL"), env("SOURCE_SERVICE_ROLE_KEY"), opts);
const target = createClient(env("TARGET_SUPABASE_URL"), env("TARGET_SERVICE_ROLE_KEY"), opts);
const dryRun = process.argv.includes("--dry-run");

if (env("SOURCE_SUPABASE_URL") === env("TARGET_SUPABASE_URL")) {
  console.error("Source and target are the same project.");
  process.exit(1);
}

async function rows(table, query = (q) => q) {
  const { data, error } = await query(source.from(table).select("*"));
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

// Refuse to overwrite a production project that's already in use.
const { count: existing, error: countError } = await target
  .from("bookings")
  .select("id", { count: "exact", head: true });
if (countError) throw new Error(`target bookings: ${countError.message} (run db:push first?)`);
if (existing > 0) {
  console.error(`Target already has ${existing} bookings: refusing to copy over a live project.`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const plan = {
  services: await rows("services"),
  add_ons: await rows("add_ons"),
  availability_rules: await rows("availability_rules"),
  blackout_dates: await rows("blackout_dates", (q) => q.gte("date", today)),
  portfolio_images: await rows("portfolio_images"),
  reviews: await rows("reviews"),
};
const [settings] = await rows("business_settings");

const files = [
  ...plan.services
    .map((s) => s.cover_image_path)
    .filter(Boolean)
    .map((p) => ["portfolio", p]),
  ...plan.services.flatMap((s) => (s.workshop_slides ?? []).map((w) => ["portfolio", w.path])),
  ...plan.portfolio_images.map((p) => ["portfolio", p.storage_path]),
  ...(settings.logo_path ? [["brand", settings.logo_path]] : []),
];

console.table(
  Object.fromEntries([
    ...Object.entries(plan).map(([t, r]) => [t, r.length]),
    ["image files", files.length],
  ]),
);
if (dryRun) {
  console.log("Dry run: nothing copied.");
  process.exit(0);
}

// Order matters: portfolio photos and booking add-ons point at packages/add-ons.
for (const [table, data] of Object.entries(plan)) {
  if (!data.length) continue;
  if (table === "availability_rules") await target.from(table).delete().gte("day_of_week", 0);
  const { error } = await target.from(table).upsert(data);
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`copied ${data.length} ${table}`);
}
const { id: _id, updated_at: _u, ...settingsRow } = settings;
const { error: settingsError } = await target
  .from("business_settings")
  .update(settingsRow)
  .eq("id", true);
if (settingsError) throw new Error(`business_settings: ${settingsError.message}`);
console.log("copied business settings");

for (const [bucket, path] of files) {
  const { data, error } = await source.storage.from(bucket).download(path);
  if (error) throw new Error(`download ${bucket}/${path}: ${error.message}`);
  const up = await target.storage
    .from(bucket)
    .upload(path, data, { upsert: true, contentType: data.type || undefined });
  if (up.error) throw new Error(`upload ${bucket}/${path}: ${up.error.message}`);
}
console.log(`copied ${files.length} image files`);
console.log("Done. Next: create the owner admin on the new project (npm run admin:create).");
