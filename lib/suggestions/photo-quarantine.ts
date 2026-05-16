// Photo-quarantine ops for Suggestion submits (ADR-0003).
//
// Anonymous uploads land in the private `suggestion-photos` bucket under a
// path shaped `<v4 uuid>/<filename>` — the bucket's anon INSERT policy
// (migration 0011) enforces the prefix server-side; this module enforces it
// again at the server-action layer (defence in depth + canonical shape for
// promote / discard).
//
// Both `promotePhoto` and `discardPhoto` are written against a tiny
// `StorageLike` interface — the real Supabase storage client implements it,
// and the unit tests inject a fake. The deep module knows nothing about
// `@supabase/supabase-js` internals.

export const QUARANTINE_BUCKET = "suggestion-photos";
export const RESTAURANT_BUCKET = "restaurant-photos";

// Path traversal check is implicit in the regex (no `..`, no leading slash).
// The `[0-9a-f]` segments anchor to lowercase but the test accepts uppercase —
// we normalise via `i` flag.
const QUARANTINE_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/].*$/i;

export function isValidQuarantinePath(path: string): boolean {
  if (!path || path.includes("..")) return false;
  return QUARANTINE_PATH_RE.test(path);
}

// --- StorageLike: the subset of supabase.storage we actually use ---

type DownloadResult = { data: Blob | null; error: { message: string } | null };
type UploadResult = { error: { message: string } | null };
type RemoveResult = { error: { message: string } | null };
type PublicUrlResult = { data: { publicUrl: string } };

type StorageBucketLike = {
  download(path: string): Promise<DownloadResult>;
  upload(
    path: string,
    body: Blob,
    options?: { contentType?: string; upsert?: boolean },
  ): Promise<UploadResult>;
  remove(paths: string[]): Promise<RemoveResult>;
  getPublicUrl(path: string): PublicUrlResult;
};

export interface StorageLike {
  from(bucket: string): StorageBucketLike;
}

export type PromoteResult = { ok: true; publicUrl: string } | { ok: false; error: string };

/**
 * Move a quarantine object into the public `restaurant-photos` bucket.
 *
 *   1. download from suggestion-photos
 *   2. upload to restaurant-photos (same relative path → preserves the UUID
 *      namespace + filename so collisions are essentially impossible)
 *   3. getPublicUrl from restaurant-photos
 *   4. remove from suggestion-photos
 *
 * Steps 1 and 2 are the load-bearing failures: if either fails, we abort and
 * leave the quarantine copy untouched so a retry is possible. Step 4 is
 * best-effort — a failed remove just leaves an orphan that the daily cron
 * (#11) sweeps up. We log it and report success.
 */
export async function promotePhoto(
  storage: StorageLike,
  quarantinePath: string,
): Promise<PromoteResult> {
  const src = storage.from(QUARANTINE_BUCKET);
  const dst = storage.from(RESTAURANT_BUCKET);

  const dl = await src.download(quarantinePath);
  if (dl.error || !dl.data) {
    return { ok: false, error: dl.error?.message ?? "download returned no blob" };
  }

  // Preserve the relative path — `<uuid>/<filename>` keeps collisions to
  // ~zero and avoids surfacing the original UUID to the public URL pattern
  // since the path was opaque to begin with.
  const destPath = quarantinePath;
  const up = await dst.upload(destPath, dl.data, {
    contentType: dl.data.type || "image/jpeg",
    upsert: false,
  });
  if (up.error) {
    return { ok: false, error: up.error.message };
  }

  const { data } = dst.getPublicUrl(destPath);

  const rm = await src.remove([quarantinePath]);
  if (rm.error) {
    // Don't fail the promotion — the public copy already exists and the
    // restaurant write will succeed. Cron sweeps the orphan.
    console.warn(
      `[photo-quarantine] promote succeeded but quarantine remove failed: ${rm.error.message}`,
    );
  }

  return { ok: true, publicUrl: data.publicUrl };
}

/**
 * Delete a quarantine object. Used by reject + by accept-flow when the admin
 * uploaded their own photo and is discarding the submitter's. Best-effort —
 * a storage failure is logged but does not throw, so the caller's own
 * successful work isn't rolled back.
 */
export async function discardPhoto(
  storage: StorageLike,
  quarantinePath: string | null | undefined,
): Promise<void> {
  if (!quarantinePath) return;
  const { error } = await storage.from(QUARANTINE_BUCKET).remove([quarantinePath]);
  if (error) {
    console.warn(`[photo-quarantine] discard failed for ${quarantinePath}: ${error.message}`);
  }
}
