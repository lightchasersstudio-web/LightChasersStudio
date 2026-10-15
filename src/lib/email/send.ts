import "server-only";

import { getServerEnv } from "@/lib/env.server";

export type Email = { to: string; subject: string; html: string; text: string };

/**
 * Sends through Resend. Never throws: an email failure must not undo a booking,
 * so problems (or a missing API key) are logged and skipped.
 */
export async function sendEmail(email: Email): Promise<void> {
  const { RESEND_API_KEY, EMAIL_FROM } = getServerEnv();
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
