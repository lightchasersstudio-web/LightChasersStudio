import "server-only";

import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { createElement } from "react";

import { formatSummaryWhen } from "@/lib/booking/booking-summary";
import { receiptEmail } from "@/lib/email/booking-emails";
import { sendEmail } from "@/lib/email/send";
import { getPublicEnv } from "@/lib/env";
import { paymentPurposeLabel, providerLabel } from "@/lib/payments/providers";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { formatPeso } from "@/lib/utils/money";
import { loadBrand, renderPdf } from "@/server/pdf/kit";
import { ReceiptDocument, type ReceiptData } from "@/server/pdf/receipt";
import { loadBookingRecord, type BookingRecord } from "@/server/queries/booking-record";

// Receipts (Studio Policy Manual 1.5): every paid payment has a number
// (payments.receipt_number, set by a trigger) and a PDF, emailed to the client.

type Receipt = { data: ReceiptData; record: BookingRecord; amountCents: number; method: string };

/**
 * One paid payment's receipt (SERVICE ROLE: callers must already have checked
 * access, i.e. an admin or the verified payment webhook). Null if it isn't paid.
 */
export async function loadReceipt(paymentId: string): Promise<Receipt | null> {
  const supabase = createAdminClient();
  const { data: payment, error } = await supabase
    .from("payments")
    .select(
      "id, booking_id, provider, purpose, amount_cents, status, paid_at, created_at, reference, receipt_number, received_from",
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw error;
  if (!payment || payment.status !== "paid" || !payment.receipt_number) return null;

  const [record, { data: paid, error: paidError }] = await Promise.all([
    loadBookingRecord({ id: payment.booking_id }),
    supabase
      .from("payments")
      .select("id, amount_cents, paid_at, created_at")
      .eq("booking_id", payment.booking_id)
      .eq("status", "paid"),
  ]);
  if (paidError) throw paidError;
  if (!record) return null;

  // Paid up to and including this payment, in the order they were paid.
  const at = (p: { paid_at: string | null; created_at: string }) => p.paid_at ?? p.created_at;
  const key = (p: { id: string; paid_at: string | null; created_at: string }) => `${at(p)}|${p.id}`;
  const paidToDate = (paid ?? [])
    .filter((p) => key(p) <= key(payment))
    .reduce((sum, p) => sum + p.amount_cents, 0);
  const total = record.summary.priceCents;
  const method = providerLabel(payment.provider);

  return {
    record,
    amountCents: payment.amount_cents,
    method,
    data: {
      number: payment.receipt_number,
      paidOn: format(new TZDate(at(payment), BUSINESS_TZ), "d MMM yyyy, h:mm a"),
      // Kept on the payment: receipts outlive a client's deleted details.
      receivedFrom: payment.received_from ?? record.summary.contactName,
      amount: formatPeso(payment.amount_cents),
      purpose: paymentPurposeLabel({
        provider: payment.provider,
        purpose: payment.purpose,
        amountCents: payment.amount_cents,
        totalCents: total,
      }),
      method,
      reference: payment.reference,
      bookingReference: record.summary.reference,
      packageName: record.summary.serviceName,
      when: formatSummaryWhen(record.summary),
      total: formatPeso(total),
      paidToDate: formatPeso(paidToDate),
      balance: total - paidToDate > 0 ? formatPeso(total - paidToDate) : "Fully paid",
    },
  };
}

export const receiptFileName = (number: string) => `receipt-${number}.pdf`;

/** The receipt as PDF bytes. */
export async function receiptPdf(receipt: Receipt): Promise<Buffer> {
  const brand = await loadBrand(createAdminClient());
  return renderPdf(createElement(ReceiptDocument, { brand, receipt: receipt.data }));
}

/**
 * Emails the receipt PDF to the client. Returns false when there's nothing to
 * send (unpaid, or no email). Never throws: a receipt must not undo a payment.
 */
export async function emailReceipt(paymentId: string): Promise<boolean> {
  try {
    const receipt = await loadReceipt(paymentId);
    if (!receipt?.record.email) return false;
    const pdf = await receiptPdf(receipt);
    const siteUrl = getPublicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
    await sendEmail({
      to: receipt.record.email,
      ...receiptEmail(receipt.record.summary, siteUrl, {
        number: receipt.data.number,
        amountCents: receipt.amountCents,
        method: receipt.method,
      }),
      attachments: [
        {
          filename: receiptFileName(receipt.data.number),
          content: pdf,
          contentType: "application/pdf",
        },
      ],
    });
    return true;
  } catch (error) {
    console.error("[receipt] email", error);
    return false;
  }
}
