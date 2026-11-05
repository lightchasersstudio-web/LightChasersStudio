"use client";

import { Share2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Opens the phone's share sheet (Messenger, Viber, ...) where supported, and
 * copies the link everywhere else.
 */
export function ShareButton({
  path,
  title,
  text,
  label = "Share",
  className,
  variant = "outline",
  size,
}: {
  /** Site path to share, e.g. /services/prenup-session. */
  path: string;
  title: string;
  text?: string;
  label?: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  async function share() {
    const url = new URL(path, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return; // closed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied. Paste it anywhere to share.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={share}>
      <Share2Icon aria-hidden />
      {label}
    </Button>
  );
}
