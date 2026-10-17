"use client";

import { CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ReplyTemplate } from "@/lib/booking/reply-templates";
import { cn } from "@/lib/utils";

/** Pick a ready-made reply, tweak it if needed, copy it into Messenger. */
export function ReplyTemplates({ templates }: { templates: ReplyTemplate[] }) {
  const [id, setId] = useState(templates[0]!.id);
  const template = templates.find((t) => t.id === id) ?? templates[0]!;
  const [text, setText] = useState(template.text);

  function pick(t: ReplyTemplate) {
    setId(t.id);
    setText(t.text);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Message copied. Paste it into Messenger.");
    } catch {
      toast.error("Couldn't copy. Select the text instead.");
    }
  }

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Message type" className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={t.id === id}
            onClick={() => pick(t)}
            className={cn(
              "min-h-9 rounded-full border px-3 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              t.id === id
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:border-terracotta hover:bg-accent",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        aria-label={`${template.label} message`}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Edit anything before copying. Fill in the parts in [brackets].
        </p>
        <Button type="button" onClick={copy}>
          <CopyIcon aria-hidden />
          Copy message
        </Button>
      </div>
    </div>
  );
}
