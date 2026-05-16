"use client";

// Anonymous client-direct upload to the private `suggestion-photos` bucket.
//
// Uses the Supabase browser client (publishable key). The bucket's anon INSERT
// policy permits writes only when the path matches `<uuid>/<filename>`, so we
// generate a v4 UUID prefix client-side and append the resized JPEG. The
// bucket is private — there's no public read URL — so the preview shown to
// the submitter after upload is the original-file dataURL we captured before
// resize, not a Storage URL. The server action validates the returned path
// against the same UUID-prefix shape before persisting it on the Suggestion.

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { resizeImage } from "@/lib/photo-resize";

export type QuarantinePhotoValue = {
  path: string;
  /** Local-data URL preview captured pre-upload — the bucket is private. */
  previewUrl: string;
};

export function QuarantinePhotoUpload({
  value,
  onChange,
}: {
  value: QuarantinePhotoValue | null;
  onChange: (next: QuarantinePhotoValue | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      // Capture the pre-resize preview first so the UI can show something
      // even though the bucket is unreadable for anon.
      const previewUrl = URL.createObjectURL(file);

      const blob = await resizeImage(file);
      const uuid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : fallbackUuid();
      const ext = "jpg";
      const path = `${uuid}/photo.${ext}`;

      const supabase = createClient();
      const { error: uploadErr } = await supabase.storage
        .from("suggestion-photos")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (uploadErr) throw uploadErr;

      onChange({ path, previewUrl });
      toast.success("Photo attached — will go to the queue with your suggestion.");
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {value ? (
        // Plain <img>: the data URL is local; next/image would complain about
        // the unknown source. Per docs/design-memory.md, supplementary photos
        // use plain <img>.
         
        <div className="ring-foreground/10 relative aspect-[16/9] w-full overflow-hidden rounded-xl ring-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.previewUrl}
            alt="Photo you uploaded"
            className="h-full w-full object-cover"
          />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute top-2 right-2"
            aria-label="Remove photo"
            onClick={clear}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          <Upload className="mr-2 size-4" />
          {busy ? "Uploading…" : value ? "Replace photo" : "Attach a photo"}
        </Button>
        <span className="text-muted-foreground text-xs">
          Optional. Resized to 1200px, JPEG. Only the admin sees it.
        </span>
      </div>
    </div>
  );
}

function fallbackUuid(): string {
  // RFC4122 v4-shape fallback for older browsers / non-secure contexts.
  // The bucket policy regex doesn't care about RFC bit-pattern correctness —
  // only the segment-length shape — so a simple hex-random suffices.
  const hex = "0123456789abcdef";
  const seg = (n: number) =>
    Array.from({ length: n }, () => hex[Math.floor(Math.random() * 16)]).join("");
  return `${seg(8)}-${seg(4)}-${seg(4)}-${seg(4)}-${seg(12)}`;
}
