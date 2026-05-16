"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type ShareButtonProps = {
  name: string;
  slug: string;
  className?: string;
};

/**
 * Quiet "share this restaurant" affordance: the native share sheet when the
 * browser has one, otherwise copy the link and confirm with a toast.
 */
export function ShareButton({ name, slug, className }: ShareButtonProps) {
  async function handleShare() {
    const url = `https://dining.ninkuk.com/${slug}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: name, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      // Dismissed share sheet (AbortError) or a denied clipboard write — no-op.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => void handleShare()}
      className={className}
    >
      <Share2 className="size-4" />
      Share
    </Button>
  );
}
