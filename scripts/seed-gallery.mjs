// Lokalni dev seed za galeriju.
// Uzima slike iz ../../Slike/, konvertuje ih u WebP (1920px, q=88) — kao što server radi —
// uploaduje u lokalni Supabase storage bucket `gallery` i inserts u tabelu `gallery_images`.
// Pokretanje: node scripts/seed-gallery.mjs

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!SUPABASE_URL.includes("127.0.0.1") && !SUPABASE_URL.includes("localhost")) {
  console.error(`Refusing: env not local (${SUPABASE_URL})`);
  process.exit(1);
}

const SOURCE_DIR = join(__dirname, "..", "..", "Slike");

// Po jedan uzorak po kategoriji + više za sminkanje (glavno)
const PLAN = [
  { category: "sminkanje", count: 5 },
  { category: "svadbeno", count: 3 },
  { category: "pedikir", count: 2 },
  { category: "trepavice", count: 2 },
  { category: "obuka", count: 1 },
];

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

async function main() {
  // Wipe postojeće lokalne galerijske podatke (dev only)
  console.log("→ Brisem postojeće galerijske redove...");
  await sb.from("gallery_images").delete().neq("id", 0);
  const { data: existing } = await sb.storage.from("gallery").list("", { limit: 100 });
  if (existing?.length) {
    const allFiles = [];
    for (const folder of existing) {
      if (folder.id === null) {
        const { data: files } = await sb.storage.from("gallery").list(folder.name);
        files?.forEach((f) => allFiles.push(`${folder.name}/${f.name}`));
      }
    }
    if (allFiles.length) await sb.storage.from("gallery").remove(allFiles);
  }

  const allFiles = (await readdir(SOURCE_DIR)).filter((f) =>
    /\.(jpe?g|png|webp)$/i.test(f),
  );
  console.log(`→ Pronađeno ${allFiles.length} izvornih slika u Slike/`);

  // Pseudo-random ali deterministički (sortirano + skip pattern)
  const sorted = allFiles.sort();
  const totalNeeded = PLAN.reduce((s, p) => s + p.count, 0);
  const step = Math.max(1, Math.floor(allFiles.length / totalNeeded));
  const picks = [];
  for (let i = 0; i < totalNeeded; i++) picks.push(sorted[i * step]);

  let pickIdx = 0;
  let orderIdx = 1;
  for (const { category, count } of PLAN) {
    for (let i = 0; i < count; i++) {
      const sourceName = picks[pickIdx++];
      const buffer = await readFile(join(SOURCE_DIR, sourceName));

      const webp = await sharp(buffer)
        .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 88 })
        .toBuffer();

      const ts = Date.now() + orderIdx;
      const rand = Math.random().toString(36).slice(2, 8);
      const path = `${category}/${ts}-${rand}.webp`;

      const { error: upErr } = await sb.storage.from("gallery").upload(path, webp, {
        contentType: "image/webp",
        upsert: false,
      });
      if (upErr) throw new Error(`Upload ${path}: ${upErr.message}`);

      const { error: insErr } = await sb.from("gallery_images").insert({
        storage_path: path,
        category,
        alt_text: `UP Beauty — ${category} ${i + 1}`,
        order_index: orderIdx,
      });
      if (insErr) throw new Error(`Insert ${path}: ${insErr.message}`);

      console.log(
        `  ✓ [${category}] ${sourceName.slice(0, 30)}... → ${path} (${(webp.length / 1024).toFixed(0)} KB)`,
      );
      orderIdx++;
    }
  }

  console.log(`\n✓ Seed završen — ${totalNeeded} slika uploaded`);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
