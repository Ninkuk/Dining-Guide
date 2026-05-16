"use client";

// Client-side image upload to Supabase Storage. Resizes images down to ≤1200px
// wide via a <canvas> to keep payloads under ~200KB (JPEG q=0.8). Returns the
// public URL via onChange so the parent form can pin it on the restaurant row.

import { useState, useRef } from "react";
import { Upload, X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const MAX_WIDTH = 1200;
const QUALITY = 0.8;

async function resizeImage(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result as string);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new window.Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });

  const scale = Math.min(1, MAX_WIDTH / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((res, rej) => {
    canvas.toBlob(
      (blob) => (blob ? res(blob) : rej(new Error("toBlob returned null"))),
      "image/jpeg",
      QUALITY,
    );
  });
}

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
        <span className="text-muted-foreground text-xs">Resized to {MAX_WIDTH}px, JPEG.</span>
      </div>
    </div>
  );
}
