"use client";

import { MailIcon, MessageCircleIcon, MessageSquareIcon, PhoneIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ContactMethod } from "@/lib/validations/booking";

const MESSENGER_LINK = /^https?:\/\/(www\.)?(facebook\.com|m\.me|messenger\.com)\//i;

/** One-tap ways to reach the client; their preferred one is highlighted. No Viber. */
export function ContactActions({
  phone,
  email,
  messenger,
  preferred,
  reference,
}: {
  phone: string;
  email: string | null;
  messenger: string | null;
  preferred: string;
  reference: string;
}) {
  const digits = phone.replace(/[^\d+]/g, "");
  const ring = (method: ContactMethod) =>
    cn(preferred === method && "ring-2 ring-terracotta ring-offset-2 ring-offset-card");

  async function openMessenger() {
    if (!messenger) return;
    if (MESSENGER_LINK.test(messenger)) {
      window.open(messenger, "_blank", "noopener");
      return;
    }
    // Only a name: copy it so it can be pasted into Messenger's search.
    try {
      await navigator.clipboard.writeText(messenger);
      toast.success(`Copied “${messenger}”. Paste it into Messenger's search.`);
    } catch {
      toast.message(`Search Messenger for “${messenger}”.`);
    }
    window.open("https://www.messenger.com/", "_blank", "noopener");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" className={ring("phone")}>
          <a href={`tel:${digits}`}>
            <PhoneIcon aria-hidden />
            Call
          </a>
        </Button>
        <Button asChild variant="outline" className={ring("sms")}>
          <a href={`sms:${digits}`}>
            <MessageSquareIcon aria-hidden />
            Text
          </a>
        </Button>
        {email && (
          <Button asChild variant="outline" className={ring("email")}>
            <a
              href={`mailto:${email}?subject=${encodeURIComponent(`Your Light Chasers booking ${reference}`)}`}
            >
              <MailIcon aria-hidden />
              Email
            </a>
          </Button>
        )}
        {messenger && (
          <Button
            type="button"
            variant="outline"
            className={ring("messenger")}
            onClick={openMessenger}
          >
            <MessageCircleIcon aria-hidden />
            Messenger
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Prefers{" "}
        {{
          email: "email",
          phone: "a call",
          sms: "a text",
          messenger: "Messenger",
          viber: "a call",
        }[preferred] ?? preferred}
        .
      </p>
    </div>
  );
}
