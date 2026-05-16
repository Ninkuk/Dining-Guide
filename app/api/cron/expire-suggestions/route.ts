// Daily auto-expiry cron for stale Suggestions and quarantine photos
// (ADR-0003 + parent PRD §System (auto-expiry)).
//
// Vercel triggers this endpoint per the schedule in `vercel.json` and includes
// `Authorization: Bearer $CRON_SECRET` when the env var is provisioned. The
// handler rejects any request whose header doesn't match — including the
// "env var missing" case, which fails closed so a misconfigured project can't
// silently expose the endpoint.
//
// One daily run, idempotent under re-execution (a second run within the same
// day finds nothing past the cutoffs and is a no-op):
//
//   1. List quarantine bucket objects older than 30 days; delete them.
//   2. Mark pending Suggestions whose photo was just removed (or was already
//      missing) as `rejected` with `admin_note='auto-expired: photo removed
//      after 30 days'`.
//   3. Mark remaining pending Suggestions older than 30 days as `rejected`
//      with `admin_note='auto-expired: pending for 30 days'`.
//   4. Hard-delete `rejected` Suggestions whose `decided_at` is older than 30
//      more days — also remove any lingering quarantine photos they referenced.
//
// Suggestion authority is the only source of truth for "is this photo still
// needed" — the bucket walk in step 1 catches the absolute-time cutoff; step 4
// catches per-Suggestion lifecycle. Both are deliberately conservative.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { QUARANTINE_BUCKET } from "@/lib/suggestions/photo-quarantine";

const PENDING_TTL_DAYS = 30;
const REJECTED_TTL_DAYS = 30; // additional, measured from decided_at
const DAY_MS = 24 * 60 * 60 * 1000;

const PHOTO_EXPIRED_NOTE = "auto-expired: photo removed after 30 days";
const PENDING_EXPIRED_NOTE = "auto-expired: pending for 30 days";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("expire-suggestions: CRON_SECRET is not configured");
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
  }

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const now = new Date();
  const pendingCutoff = new Date(now.getTime() - PENDING_TTL_DAYS * DAY_MS);
  const rejectedCutoff = new Date(now.getTime() - REJECTED_TTL_DAYS * DAY_MS);
  const nowIso = now.toISOString();
  const pendingCutoffIso = pendingCutoff.toISOString();
  const rejectedCutoffIso = rejectedCutoff.toISOString();

  const summary = {
    photosDeleted: 0,
    photoOrphanRejections: 0,
    pendingRejections: 0,
    hardDeleted: 0,
  };

  // --- Step 1: delete quarantine objects older than 30 days ----------------
  //
  // Storage upload paths look like `<uuid>/<filename>` (see ADR-0003 + the
  // QuarantinePhotoUpload component). list('') returns top-level entries — in
  // our case, UUID "folders" with id=null. We descend one level into each and
  // collect objects past the cutoff.
  const expiredPaths = await listExpiredQuarantineObjects(supabase, pendingCutoff);
  if (expiredPaths.length > 0) {
    const { error: rmErr } = await supabase.storage.from(QUARANTINE_BUCKET).remove(expiredPaths);
    if (rmErr) {
      console.error("expire-suggestions: bucket remove failed:", rmErr);
    } else {
      summary.photosDeleted = expiredPaths.length;
    }
  }

  // --- Step 2: mark pending Suggestions whose photo is now gone ------------
  if (expiredPaths.length > 0) {
    const { data: orphaned } = await supabase
      .from("suggestions")
      .select("id")
      .eq("status", "pending")
      .in("photo_path", expiredPaths);
    const orphanIds = (orphaned ?? []).map((r) => r.id);
    if (orphanIds.length > 0) {
      const { error: updErr } = await supabase
        .from("suggestions")
        .update({
          status: "rejected",
          admin_note: PHOTO_EXPIRED_NOTE,
          decided_at: nowIso,
        })
        .in("id", orphanIds)
        .eq("status", "pending"); // idempotency guard against concurrent decisions
      if (updErr) {
        console.error("expire-suggestions: orphan-photo reject failed:", updErr);
      } else {
        summary.photoOrphanRejections = orphanIds.length;
      }
    }
  }

  // --- Step 3: mark remaining pending Suggestions older than 30 days -------
  const { data: stalePending, error: pendingErr } = await supabase
    .from("suggestions")
    .update({
      status: "rejected",
      admin_note: PENDING_EXPIRED_NOTE,
      decided_at: nowIso,
    })
    .eq("status", "pending")
    .lt("created_at", pendingCutoffIso)
    .select("id");
  if (pendingErr) {
    console.error("expire-suggestions: stale-pending reject failed:", pendingErr);
  } else {
    summary.pendingRejections = (stalePending ?? []).length;
  }

  // --- Step 4: hard-delete rejected Suggestions older than the rejected TTL
  // --- (60 days from creation in the common path; measured from decided_at)
  const { data: toDelete } = await supabase
    .from("suggestions")
    .select("id, photo_path")
    .eq("status", "rejected")
    .lt("decided_at", rejectedCutoffIso);

  const lingeringPhotos = (toDelete ?? []).map((r) => r.photo_path).filter((p): p is string => !!p);
  if (lingeringPhotos.length > 0) {
    const { error: rmErr } = await supabase.storage.from(QUARANTINE_BUCKET).remove(lingeringPhotos);
    if (rmErr) {
      console.error("expire-suggestions: hard-delete photo cleanup failed:", rmErr);
    }
  }

  const idsToDelete = (toDelete ?? []).map((r) => r.id);
  if (idsToDelete.length > 0) {
    const { error: delErr } = await supabase.from("suggestions").delete().in("id", idsToDelete);
    if (delErr) {
      console.error("expire-suggestions: hard-delete failed:", delErr);
    } else {
      summary.hardDeleted = idsToDelete.length;
    }
  }

  console.warn(
    JSON.stringify({
      event: "cron_expire_suggestions",
      ts: nowIso,
      ...summary,
    }),
  );
  return NextResponse.json({ ok: true, ...summary });
}

/**
 * Walk the quarantine bucket and return the full list of object paths
 * (`<uuid>/<filename>`) whose `created_at` is at or before the cutoff.
 *
 * The Supabase storage `list` API is shallow — it returns the contents of a
 * single folder. Our uploads always live one level deep, so we list the root
 * (gets UUID directories), then list inside each. At expected volume
 * (≤10 photos/month) this is a handful of round-trips at most.
 */
async function listExpiredQuarantineObjects(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cutoff: Date,
): Promise<string[]> {
  const { data: rootEntries, error: rootErr } = await supabase.storage
    .from(QUARANTINE_BUCKET)
    .list("", { limit: 1000 });
  if (rootErr) {
    console.error("expire-suggestions: bucket list failed:", rootErr);
    return [];
  }

  const out: string[] = [];
  const cutoffMs = cutoff.getTime();
  for (const entry of rootEntries ?? []) {
    // Folders have a null id; files (which shouldn't appear at root in our
    // layout, but handle them defensively) have a non-null id and a created_at.
    if (entry.id !== null) {
      if (entry.created_at && new Date(entry.created_at).getTime() <= cutoffMs) {
        out.push(entry.name);
      }
      continue;
    }
    const { data: inner } = await supabase.storage
      .from(QUARANTINE_BUCKET)
      .list(entry.name, { limit: 1000 });
    for (const f of inner ?? []) {
      if (f.id === null) continue;
      if (f.created_at && new Date(f.created_at).getTime() <= cutoffMs) {
        out.push(`${entry.name}/${f.name}`);
      }
    }
  }
  return out;
}
