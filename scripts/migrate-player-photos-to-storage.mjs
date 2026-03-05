#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY;
const PLAYER_PHOTO_BUCKET = process.env.PLAYER_PHOTO_BUCKET ?? "player-photos";
const DRY_RUN = process.env.DRY_RUN === "1";
const PAGE_SIZE = Number(process.env.PAGE_SIZE ?? 120);
const START_FROM = Number(process.env.START_FROM ?? 0);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing SUPABASE_URL/VITE_SUPABASE_URL and/or key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY)."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const MIME_EXTENSION_MAP = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

const parseDataUri = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const payload = match[2];
  return { mimeType, payload };
};

const extFromMime = (mimeType) => MIME_EXTENSION_MAP[mimeType] ?? "jpg";

const playerLabel = (row) => {
  const names = String(row.names ?? "").trim();
  const lastnames = String(row.lastnames ?? "").trim();
  const fullName = `${names} ${lastnames}`.trim();
  return fullName.length > 0 ? fullName : `Jugador ${row.id}`;
};

const migrateOne = async (row) => {
  const parsed = parseDataUri(row.photo);
  if (!parsed) return { status: "skipped", reason: "not-data-uri" };

  let bytes;
  try {
    bytes = Buffer.from(parsed.payload, "base64");
  } catch {
    return { status: "failed", reason: "invalid-base64" };
  }

  if (bytes.length === 0) return { status: "failed", reason: "empty-bytes" };

  const extension = extFromMime(parsed.mimeType);
  const filePath = `legacy/player-${row.id}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${extension}`;

  if (DRY_RUN) {
    return { status: "dry-run", path: filePath, bytes: bytes.length };
  }

  const { error: uploadError } = await supabase.storage
    .from(PLAYER_PHOTO_BUCKET)
    .upload(filePath, bytes, {
      contentType: parsed.mimeType,
      upsert: false,
      cacheControl: "31536000",
    });

  if (uploadError) {
    return { status: "failed", reason: `upload: ${uploadError.message}` };
  }

  const { data: urlData } = supabase.storage.from(PLAYER_PHOTO_BUCKET).getPublicUrl(filePath);
  const publicUrl = urlData.publicUrl;

  const { error: updateError } = await supabase
    .from("players")
    .update({ photo: publicUrl })
    .eq("id", row.id);

  if (updateError) {
    return { status: "failed", reason: `update: ${updateError.message}` };
  }

  return { status: "updated", path: filePath, bytes: bytes.length, url: publicUrl };
};

const run = async () => {
  console.log(
    `[player-photo-migration] Starting (bucket=${PLAYER_PHOTO_BUCKET}, dryRun=${DRY_RUN}, pageSize=${PAGE_SIZE})`
  );

  let lastProcessedId = Number.isFinite(START_FROM) && START_FROM > 0 ? START_FROM : 0;
  let totalProcessed = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;

  while (true) {
    const { data, error } = await supabase
      .from("players")
      .select("id, names, lastnames, photo")
      .like("photo", "data:image/%")
      .gt("id", lastProcessedId)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);

    if (error) {
      throw new Error(`players query failed: ${error.message}`);
    }

    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      totalProcessed += 1;
      const result = await migrateOne(row);
      const label = playerLabel(row);
      lastProcessedId = Math.max(lastProcessedId, Number(row.id ?? 0));

      if (result.status === "updated") {
        updated += 1;
        console.log(`  [OK] ${label} (#${row.id}) -> ${result.path} (${result.bytes} bytes)`);
      } else if (result.status === "dry-run") {
        updated += 1;
        console.log(`  [DRY] ${label} (#${row.id}) -> ${result.path} (${result.bytes} bytes)`);
      } else if (result.status === "skipped") {
        skipped += 1;
        console.log(`  [SKIP] ${label} (#${row.id}) -> ${result.reason}`);
      } else {
        failed += 1;
        console.error(`  [FAIL] ${label} (#${row.id}) -> ${result.reason}`);
      }
    }

    if (rows.length < PAGE_SIZE) break;
  }

  console.log("[player-photo-migration] Completed");
  console.log(
    `[player-photo-migration] processed=${totalProcessed}, migrated=${updated}, failed=${failed}, skipped=${skipped}`
  );
};

run().catch((error) => {
  console.error("[player-photo-migration] Fatal error:", error.message);
  process.exit(1);
});
