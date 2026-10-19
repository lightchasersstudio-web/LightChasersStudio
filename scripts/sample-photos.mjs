// Fills the DEV site with sample photos (free Unsplash images) so every page
// looks finished: portfolio photos (some featured, some linked to a package)
// and cover photos for packages that don't have one yet.
//
//   npm run data:sample-photos             # add them (skips if already there)
//   npm run data:sample-photos -- --remove # take every sample photo out again
//
// Sample files are named with a fixed id prefix (SAMPLE), so removing them never
// touches photos uploaded in the admin. Refuses anything but the dev project.
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const DEV_PROJECT_REF = "mkpjxrhjynbjuiovloiy";
const SAMPLE = "5a301e00"; // "sample", as hex
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url.includes(DEV_PROJECT_REF) || !key) {
  console.error(
    `Refusing: this only runs against the dev project (${DEV_PROJECT_REF}). ` +
      "Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const fail = (what, error) => {
  console.error(`${what} failed:`, error.message);
  process.exit(1);
};

/** A uuid-shaped id that marks the file as a sample. */
const sampleId = () => `${SAMPLE}${randomUUID().slice(8)}`;
const isSample = (path) => path?.split("/").pop()?.startsWith(SAMPLE);

// [Unsplash photo id, category, alt text, featured, package slug to link]
const PHOTOS = [
  [
    "1583939003579-730e3918a45a",
    "wedding",
    "Bride and groom kissing as guests throw petals",
    true,
    "wedding-day-coverage",
  ],
  [
    "1606216794074-735e91aa2c92",
    "wedding",
    "Newlyweds walking hand in hand under palm trees",
    false,
    "prenup-session",
  ],
  [
    "1511285560929-80b456fea0bc",
    "wedding",
    "Couple releasing red balloons at their reception",
    true,
    "wedding-day-coverage",
  ],
  [
    "1465495976277-4387d4b0b4c6",
    "wedding",
    "Close-up of the couple's hands and wedding rings",
    false,
    null,
  ],
  [
    "1522673607200-164d1b6ce486",
    "wedding",
    "Two decorated chairs for the couple on a lawn",
    false,
    null,
  ],
  ["1515934751635-c81c6bc9a2d8", "wedding", "Wedding rings resting on pink roses", false, null],
  [
    "1529636798458-92182e662485",
    "wedding",
    "Bridal bouquet held against a white dress",
    false,
    "prenup-session",
  ],
  [
    "1609220136736-443140cffec6",
    "portrait",
    "Smiling father carrying his two children",
    true,
    "family-portrait-session",
  ],
  [
    "1511895426328-dc8714191300",
    "portrait",
    "Family holding hands on the beach at sunset",
    false,
    "family-portrait-session",
  ],
  ["1438761681033-6461ffad8d80", "portrait", "Portrait of a young woman by the water", true, null],
  ["1507003211169-0a1dd7228f2d", "portrait", "Smiling man in a white t-shirt", false, null],
  ["1544005313-94ddf0286df2", "portrait", "Portrait of a woman in a striped shirt", false, null],
  [
    "1503454537195-1dcabb73ffb9",
    "portrait",
    "Little girl laughing with paint on her face",
    false,
    null,
  ],
  [
    "1555252333-9f8e92e65df9",
    "portrait",
    "Newborn's tiny feet wrapped in a soft blanket",
    false,
    "maternity-newborn",
  ],
  [
    "1519689680058-324335c77eba",
    "portrait",
    "Baby in sunglasses lying on a pool float",
    false,
    "maternity-newborn",
  ],
  [
    "1470116945706-e6bf5d5a53ca",
    "portrait",
    "A parent holding a newborn's hand",
    false,
    "maternity-newborn",
  ],
  [
    "1527529482837-4698179dc6ce",
    "event",
    "Guests raising a toast at a dinner party",
    true,
    "event-coverage",
  ],
  [
    "1464366400600-7168b8af9bc3",
    "event",
    "Banquet tables set with flowers for a celebration",
    false,
    "event-coverage",
  ],
  [
    "1530103862676-de8c9debad1d",
    "event",
    "Colourful balloons at a birthday party",
    false,
    "photobooth",
  ],
  [
    "1513151233558-d860c5398176",
    "event",
    "Confetti falling against a blue backdrop",
    false,
    "photobooth",
  ],
  [
    "1492684223066-81342ee5ff30",
    "event",
    "Crowd cheering under confetti at a concert",
    false,
    null,
  ],
  [
    "1540575467063-178a50c2df87",
    "event",
    "Audience at a corporate conference",
    false,
    "event-coverage",
  ],
  [
    "1542291026-7eec264c27ff",
    "commercial",
    "Red running shoe on a red background",
    true,
    "product-photography",
  ],
  [
    "1523275335684-37898b6baf30",
    "commercial",
    "White smartwatch on a white background",
    false,
    "product-photography",
  ],
  [
    "1505740420928-5e560c06d30e",
    "commercial",
    "Black headphones on a yellow background",
    false,
    "product-photography",
  ],
  ["1526170375885-4d8ecf77b99f", "commercial", "Instant camera on a white table", false, null],
  [
    "1596462502278-27bfdc403348",
    "commercial",
    "Make-up brushes and cosmetics flat lay",
    false,
    "product-photography",
  ],
];

// Cover photos for packages that have none yet: [slug, Unsplash photo id].
const COVERS = [
  ["prenup-session", "1606216794074-735e91aa2c92"],
  ["family-portrait-session", "1609220136736-443140cffec6"],
  ["maternity-newborn", "1555252333-9f8e92e65df9"],
  ["event-coverage", "1527529482837-4698179dc6ce"],
  ["product-photography", "1542291026-7eec264c27ff"],
  ["photobooth", "1530103862676-de8c9debad1d"],
  ["wedding-day-coverage", "1583939003579-730e3918a45a"],
];

/** Downloads a photo and prepares it like the admin uploader: WebP + tiny blur preview. */
async function prepare(unsplashId, maxEdge) {
  const res = await fetch(`https://images.unsplash.com/photo-${unsplashId}?w=${maxEdge}&q=85`);
  if (!res.ok) throw new Error(`Download ${unsplashId}: HTTP ${res.status}`);
  const input = Buffer.from(await res.arrayBuffer());
  const image = sharp(input).rotate().resize(maxEdge, maxEdge, { fit: "inside" });
  const { data, info } = await image.webp({ quality: 86 }).toBuffer({ resolveWithObject: true });
  const tiny = await sharp(input).rotate().resize(16).jpeg({ quality: 60 }).toBuffer();
  return {
    data,
    width: info.width,
    height: info.height,
    blur: `data:image/jpeg;base64,${tiny.toString("base64")}`,
  };
}

async function upload(path, data) {
  const { error } = await sb.storage
    .from("portfolio")
    .upload(path, data, { contentType: "image/webp", cacheControl: "31536000" });
  if (error) fail(`Uploading ${path}`, error);
}

async function add() {
  const { data: existing, error } = await sb.from("portfolio_images").select("storage_path");
  if (error) fail("Reading photos", error);
  if (existing.some((p) => isSample(p.storage_path))) {
    console.log("Sample photos are already there. Use --remove first to load them again.");
    return;
  }
  const { data: services, error: sErr } = await sb
    .from("services")
    .select("id, slug, cover_image_path");
  if (sErr) fail("Reading packages", sErr);
  const serviceId = (slug) => services.find((s) => s.slug === slug)?.id ?? null;

  const rows = [];
  for (const [i, [id, category, alt, featured, slug]] of PHOTOS.entries()) {
    const img = await prepare(id, 2000);
    const path = `${category}/${sampleId()}.webp`;
    await upload(path, img.data);
    rows.push({
      storage_path: path,
      category,
      alt_text: alt,
      width: img.width,
      height: img.height,
      blur_data_url: img.blur,
      is_featured: featured,
      sort_order: i,
      service_id: serviceId(slug),
    });
    process.stdout.write(".");
  }
  const { error: insErr } = await sb.from("portfolio_images").insert(rows);
  if (insErr) fail("Saving photos", insErr);
  console.log(`\nAdded ${rows.length} portfolio photos.`);

  let covers = 0;
  for (const [slug, id] of COVERS) {
    const service = services.find((s) => s.slug === slug);
    if (!service || service.cover_image_path) continue; // keep covers the owner uploaded
    const img = await prepare(id, 1600);
    const path = `services/${sampleId()}.webp`;
    await upload(path, img.data);
    const { error: upErr } = await sb
      .from("services")
      .update({ cover_image_path: path })
      .eq("id", service.id);
    if (upErr) fail(`Setting the ${slug} cover`, upErr);
    covers++;
  }
  console.log(`Added ${covers} package cover photos.`);
}

async function remove() {
  const { data: photos, error } = await sb.from("portfolio_images").select("id, storage_path");
  if (error) fail("Reading photos", error);
  const samplePhotos = photos.filter((p) => isSample(p.storage_path));
  if (samplePhotos.length) {
    const { error: delErr } = await sb
      .from("portfolio_images")
      .delete()
      .in(
        "id",
        samplePhotos.map((p) => p.id),
      );
    if (delErr) fail("Deleting photos", delErr);
  }

  const { data: services, error: sErr } = await sb.from("services").select("id, cover_image_path");
  if (sErr) fail("Reading packages", sErr);
  const sampleCovers = services.filter((s) => isSample(s.cover_image_path));
  for (const s of sampleCovers) {
    const { error: upErr } = await sb
      .from("services")
      .update({ cover_image_path: null })
      .eq("id", s.id);
    if (upErr) fail("Clearing a cover", upErr);
  }

  const paths = [
    ...samplePhotos.map((p) => p.storage_path),
    ...sampleCovers.map((s) => s.cover_image_path),
  ];
  if (paths.length) {
    const { error: rmErr } = await sb.storage.from("portfolio").remove(paths);
    if (rmErr) fail("Deleting files", rmErr);
  }
  console.log(`Removed ${samplePhotos.length} sample photos and ${sampleCovers.length} covers.`);
}

await (process.argv.includes("--remove") ? remove() : add());
console.log(
  "Restart `npm run dev` to see them locally. On the live site, any save in Admin → Portfolio or Services refreshes the pages.",
);
