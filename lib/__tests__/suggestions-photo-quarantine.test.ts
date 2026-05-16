import { describe, expect, it, vi } from "vitest";
import {
  discardPhoto,
  isValidQuarantinePath,
  promotePhoto,
  QUARANTINE_BUCKET,
  RESTAURANT_BUCKET,
  type StorageLike,
} from "../suggestions/photo-quarantine";

describe("isValidQuarantinePath", () => {
  it("accepts <uuid>/<filename>", () => {
    expect(isValidQuarantinePath("550e8400-e29b-41d4-a716-446655440000/photo.jpg")).toBe(true);
  });

  it("accepts <uuid>/<nested>/<filename>", () => {
    expect(isValidQuarantinePath("550e8400-e29b-41d4-a716-446655440000/2026/photo.jpg")).toBe(true);
  });

  it("rejects an empty path", () => {
    expect(isValidQuarantinePath("")).toBe(false);
  });

  it("rejects a path without a UUID prefix", () => {
    expect(isValidQuarantinePath("photo.jpg")).toBe(false);
    expect(isValidQuarantinePath("not-a-uuid/photo.jpg")).toBe(false);
  });

  it("rejects a bare UUID with no path component", () => {
    expect(isValidQuarantinePath("550e8400-e29b-41d4-a716-446655440000")).toBe(false);
  });

  it("rejects path-traversal attempts", () => {
    expect(isValidQuarantinePath("../etc/passwd")).toBe(false);
    expect(isValidQuarantinePath("550e8400-e29b-41d4-a716-446655440000/../escape.jpg")).toBe(false);
  });

  it("is case-insensitive on the UUID hex chars", () => {
    expect(isValidQuarantinePath("550E8400-E29B-41D4-A716-446655440000/photo.jpg")).toBe(true);
  });

  it("rejects malformed UUID shapes (wrong segment lengths)", () => {
    expect(isValidQuarantinePath("550e8400-e29b-41d4-a716-446655440/photo.jpg")).toBe(false);
    expect(isValidQuarantinePath("550e8400e29b41d4a716446655440000/photo.jpg")).toBe(false);
  });
});

// --- Light Storage fakes for testing promotePhoto / discardPhoto ---
//
// We don't import the real supabase client. The deep module talks to a small
// `StorageLike` interface; the fakes record calls so we can assert the right
// downloads, uploads, and removes happen.

type Call = { op: string; bucket: string; arg: unknown };

function makeStorage(
  opts: {
    downloadResult?: { data: Blob | null; error: { message: string } | null };
    uploadResult?: { error: { message: string } | null };
    removeResult?: { error: { message: string } | null };
    publicUrl?: string;
  } = {},
) {
  const calls: Call[] = [];
  const storage: StorageLike = {
    from(bucket: string) {
      return {
        async download(path: string) {
          calls.push({ op: "download", bucket, arg: path });
          return opts.downloadResult ?? { data: new Blob(["fake"]), error: null };
        },
        async upload(path: string, body: Blob, options?: { contentType?: string }) {
          calls.push({ op: "upload", bucket, arg: { path, options } });
          void body;
          return opts.uploadResult ?? { error: null };
        },
        async remove(paths: string[]) {
          calls.push({ op: "remove", bucket, arg: paths });
          return opts.removeResult ?? { error: null };
        },
        getPublicUrl(path: string) {
          calls.push({ op: "getPublicUrl", bucket, arg: path });
          return { data: { publicUrl: opts.publicUrl ?? `https://cdn.example/${bucket}/${path}` } };
        },
      };
    },
  };
  return { storage, calls };
}

describe("promotePhoto", () => {
  it("downloads from quarantine, uploads to restaurant-photos, deletes quarantine, returns public URL", async () => {
    const { storage, calls } = makeStorage({
      publicUrl: "https://cdn.example/restaurant-photos/abc/photo.jpg",
    });
    const result = await promotePhoto(storage, "abc/photo.jpg");
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.publicUrl).toBe("https://cdn.example/restaurant-photos/abc/photo.jpg");

    const ops = calls.map((c) => `${c.op}:${c.bucket}`);
    expect(ops).toContain(`download:${QUARANTINE_BUCKET}`);
    expect(ops).toContain(`upload:${RESTAURANT_BUCKET}`);
    expect(ops).toContain(`remove:${QUARANTINE_BUCKET}`);
    expect(ops).toContain(`getPublicUrl:${RESTAURANT_BUCKET}`);
  });

  it("returns an error and skips the delete when download fails", async () => {
    const { storage, calls } = makeStorage({
      downloadResult: { data: null, error: { message: "not found" } },
    });
    const result = await promotePhoto(storage, "abc/photo.jpg");
    expect(result.ok).toBe(false);
    const ops = calls.map((c) => c.op);
    expect(ops).not.toContain("upload");
    expect(ops).not.toContain("remove");
  });

  it("returns an error and skips the delete when upload fails", async () => {
    const { storage, calls } = makeStorage({
      uploadResult: { error: { message: "permission denied" } },
    });
    const result = await promotePhoto(storage, "abc/photo.jpg");
    expect(result.ok).toBe(false);
    const ops = calls.map((c) => c.op);
    expect(ops).toContain("upload");
    expect(ops).not.toContain("remove");
  });

  it("logs but does not error if the quarantine delete fails after a successful upload", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { storage } = makeStorage({
      removeResult: { error: { message: "remove failed" } },
    });
    const result = await promotePhoto(storage, "abc/photo.jpg");
    expect(result.ok).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("discardPhoto", () => {
  it("removes the quarantine path", async () => {
    const { storage, calls } = makeStorage();
    await discardPhoto(storage, "abc/photo.jpg");
    expect(calls).toEqual([{ op: "remove", bucket: QUARANTINE_BUCKET, arg: ["abc/photo.jpg"] }]);
  });

  it("is a no-op when path is null or undefined", async () => {
    const { storage, calls } = makeStorage();
    await discardPhoto(storage, null);
    await discardPhoto(storage, undefined);
    expect(calls).toEqual([]);
  });

  it("swallows + logs storage errors so the caller doesn't roll back its own success", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { storage } = makeStorage({ removeResult: { error: { message: "x" } } });
    await expect(discardPhoto(storage, "abc/photo.jpg")).resolves.not.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
