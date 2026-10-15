import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getServerEnv } from "@/lib/env.server";
import { paymentsMockEnabled } from "@/lib/payments/mock";

/** Trial mode saves emails here instead of sending them (see /admin/trial-emails). */
export const MOCK_EMAIL_DIR = path.join(process.cwd(), ".mock-emails");

export type Email = { to: string; subject: string; html: string; text: string };

/**
 * Sends through Resend. Never throws: an email failure must not undo a booking,
 * so problems (or a missing API key) are logged and skipped.
 */
export async function sendEmail(email: Email): Promise<void> {
  const { RESEND_API_KEY, EMAIL_FROM } = getServerEnv();
  if (paymentsMockEnabled() && !RESEND_API_KEY) {
    try {
      await mkdir(MOCK_EMAIL_DIR, { recursive: true });
      const at = new Date().toISOString();
      await writeFile(
        path.join(
          MOCK_EMAIL_DIR,
          `${at.replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}.json`,
        ),
        JSON.stringify({ at, ...email }),
      );
    } catch (error) {
      console.error("[email] trial preview not saved", error);
    }
    return;
  }
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    console.warn(`[email] not configured; skipped "${email.subject}"`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, ...email }),
    });
    if (!res.ok) console.error("[email]", res.status, await res.text());
  } catch (error) {
    console.error("[email]", error);
  }
}
