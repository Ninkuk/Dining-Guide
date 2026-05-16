"use client";

// Client-side image upload to Supabase Storage. The actual resize logic lives
// in `lib/photo-resize.ts` so the anonymous Suggestion-photo upload reuses
// the same canvas pipeline.

import { useState, useRef } from "react";
import { Upload, X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { resizeImage } from "@/lib/photo-resize";
import { toast } from "sonner";

export function PhotoUpload({
  value,
  onChange,
  restaurantSlug,
}: {
  value: string | null;
  onChange: (publicUrl: string | null) => void;
  restaurantSlug: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const blob = await resizeImage(file);
      const supabase = createClient();
      const ext = "jpg";
      const path = `${restaurantSlug || "untitled"}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("restaurant-photos")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from("restaurant-photos").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Photo uploaded");
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {value ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border">
          <Image src={value} alt="Restaurant photo" fill className="object-cover" sizes="600px" />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute top-2 right-2"
            aria-label="Remove photo"
            onClick={() => onChange(null)}
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
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          <Upload className="mr-2 size-4" />
          {busy ? "Uploading…" : value ? "Replace photo" : "Upload photo"}
        </Button>
        <span className="text-muted-foreground text-xs">Resized to 1200px, JPEG.</span>
      </div>
    </div>
  );
}
