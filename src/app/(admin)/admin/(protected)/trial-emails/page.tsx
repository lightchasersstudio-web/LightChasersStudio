import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { MailIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageHeader } from "@/components/admin/page-header";
import { ListSkeleton } from "@/components/admin/skeletons";
import { MOCK_EMAIL_DIR } from "@/lib/email/send";
import { paymentsMockEnabled } from "@/lib/payments/mock";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Trial emails" };

type SavedEmail = { at: string; to: string; subject: string; html: string };

export default function TrialEmailsPage() {
  return (
    <>
      <PageHeader
        eyebrow="trial mode"
        title="Emails (preview)"
        description="What clients and the studio would receive. In trial mode nothing is sent; each email is saved here instead. Newest first."
      />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Emails />
      </Suspense>
    </>
  );
}

async function Emails() {
  await requireAdmin();
  if (!paymentsMockEnabled()) notFound();

  const files = await readdir(MOCK_EMAIL_DIR).catch(() => [] as string[]);
  const emails = (
    await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .sort()
        .reverse()
        .slice(0, 30)
        .map(
          async (f) =>
            JSON.parse(await readFile(path.join(MOCK_EMAIL_DIR, f), "utf8")) as SavedEmail,
        ),
    )
  ).filter(Boolean);

  if (emails.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed p-10 text-center text-muted-foreground">
        No emails yet. Make a booking (or confirm one) and they&apos;ll appear here.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {emails.map((e, i) => (
        <li key={`${e.at}-${i}`}>
          <details open={i === 0} className="group rounded-3xl border bg-card">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4 sm:p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                <MailIcon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{e.subject}</span>
                <span className="block text-sm text-muted-foreground">
                  To {e.to} · {format(new TZDate(e.at, BUSINESS_TZ), "d MMM, h:mm:ss a")}
                </span>
              </span>
            </summary>
            {/* sandbox="": the email renders as plain content, no scripts or navigation. */}
            <iframe
              title={e.subject}
              srcDoc={e.html}
              sandbox=""
              className="h-[640px] w-full rounded-b-3xl border-t bg-white"
            />
          </details>
        </li>
      ))}
    </ul>
  );
}
