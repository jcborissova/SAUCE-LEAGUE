import { supabase } from "./supabase";

export const PLAYER_PHOTO_BUCKET = "player-photos";
const PUBLIC_OBJECT_MARKER = `/storage/v1/object/public/${PLAYER_PHOTO_BUCKET}/`;

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

const sanitizePathSegment = (value: string): string => {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40);
  return cleaned.length > 0 ? cleaned : "player";
};

const extensionFromName = (fileName: string): string | null => {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex < 0) return null;
  const extension = fileName.slice(dotIndex + 1).toLowerCase().replace(/[^a-z0-9]/g, "");
  return extension.length > 0 ? extension : null;
};

const extensionFromMime = (mimeType: string): string | null => MIME_EXTENSION_MAP[mimeType.toLowerCase()] ?? null;

const extractObjectPathFromPublicUrl = (url: string): string | null => {
  const raw = (url || "").trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    const markerIndex = parsed.pathname.indexOf(PUBLIC_OBJECT_MARKER);
    if (markerIndex < 0) return null;
    const objectPath = parsed.pathname.slice(markerIndex + PUBLIC_OBJECT_MARKER.length);
    return decodeURIComponent(objectPath);
  } catch {
    const markerIndex = raw.indexOf(PUBLIC_OBJECT_MARKER);
    if (markerIndex < 0) return null;
    return decodeURIComponent(raw.slice(markerIndex + PUBLIC_OBJECT_MARKER.length));
  }
};

export const isLegacyPhotoDataUri = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().toLowerCase().startsWith("data:image/");

export const isPlayerPhotoStorageUrl = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.includes(PUBLIC_OBJECT_MARKER);

export const uploadPlayerPhoto = async (
  file: File,
  options?: {
    playerId?: number | null;
    label?: string | null;
  }
): Promise<string> => {
  const playerKey =
    typeof options?.playerId === "number" && options.playerId > 0
      ? `player-${options.playerId}`
      : sanitizePathSegment(options?.label ?? "new");
  const extension = extensionFromMime(file.type) ?? extensionFromName(file.name) ?? "jpg";
  const objectPath = `${playerKey}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(PLAYER_PHOTO_BUCKET)
    .upload(objectPath, file, {
      upsert: false,
      cacheControl: "31536000",
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from(PLAYER_PHOTO_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
};

export const removePlayerPhotoByUrl = async (url: string): Promise<void> => {
  const objectPath = extractObjectPathFromPublicUrl(url);
  if (!objectPath) return;

  const { error } = await supabase.storage.from(PLAYER_PHOTO_BUCKET).remove([objectPath]);
  if (error) {
    throw new Error(error.message);
  }
};
