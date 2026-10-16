import { z } from "zod";

import { businessDateTimeToIso } from "@/lib/utils/business-date";
import { pesosToCents } from "@/lib/utils/money";
import { CONTACT_METHODS, type ContactMethod } from "@/lib/validations/booking";
import {
  dateString,
  intString,
  optionalText,
  pesoString,
  timeString,
} from "@/lib/validations/shared";

const contactValues = CONTACT_METHODS.map((c) => c.value) as [ContactMethod, ...ContactMethod[]];

/** Staff booking a client in. Inputs stay strings; the output is ready for admin_create_booking. */
export const adminBookingSchema = z
  .object({
    serviceId: z.uuid("Pick a package."),
    date: dateString,
    time: timeString,
    price: pesoString,
    fullName: z.string().trim().min(2, "Enter the client's name.").max(120),
    // Optional: clients arranged over Messenger may not give one.
    email: z
      .union([z.literal(""), z.email("Enter a valid email or leave it empty.")])
      .transform((v) => v.trim().toLowerCase() || null),
    phone: z.string().trim().min(7, "Enter a phone number.").max(32),
    preferredContact: z.enum(contactValues),
    messenger: optionalText(300),
    location: optionalText(300),
    participants: intString(1, 500),
    specialRequests: optionalText(2000),
    deposit: z.enum(["gcash", "cash", "none"]),
    depositAmount: z.string(),
    gcashReference: optionalText(100),
    consent: z.literal(true, "Confirm the client agreed to the privacy notice."),
    allowOutsideHours: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.preferredContact === "email" && !v.email) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Add an email to contact them by email.",
      });
    }
    if (v.preferredContact === "messenger" && !v.messenger) {
      ctx.addIssue({
        code: "custom",
        path: ["messenger"],
        message: "Add their Facebook name or link.",
      });
    }
    if (v.deposit !== "none") {
      const cents = pesosToCents(v.depositAmount);
      if (!cents) {
        ctx.addIssue({
          code: "custom",
          path: ["depositAmount"],
          message: "Enter the amount received.",
        });
      } else if (cents > v.price) {
        ctx.addIssue({
          code: "custom",
          path: ["depositAmount"],
          message: "The amount can't be more than the price.",
        });
      }
    }
  })
  .transform((v) => {
    return {
      serviceId: v.serviceId,
      startAt: businessDateTimeToIso(v.date, v.time),
      priceCents: v.price,
      fullName: v.fullName,
      email: v.email,
      phone: v.phone,
      preferredContact: v.preferredContact,
      messenger: v.messenger,
      location: v.location,
      participants: v.participants,
      specialRequests: v.specialRequests,
      payment:
        v.deposit === "none"
          ? null
          : {
              provider: v.deposit,
              amountCents: pesosToCents(v.depositAmount)!,
              reference: v.deposit === "gcash" ? v.gcashReference : null,
            },
      allowOutsideHours: v.allowOutsideHours,
    };
  });

export type AdminBookingInput = z.input<typeof adminBookingSchema>;
export type AdminBookingValues = z.output<typeof adminBookingSchema>;

export const bookingIdSchema = z.object({ id: z.uuid() });

/** Status changes staff make by hand (the DB trigger still enforces which moves are allowed). */
export const bookingStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["confirmed", "declined", "completed", "cancelled"]),
});

export const recordPaymentSchema = z
  .object({
    bookingId: z.uuid(),
    provider: z.enum(["gcash", "cash"], "Pick GCash or cash."),
    amount: pesoString,
    reference: optionalText(100),
  })
  .refine((v) => v.amount > 0, { message: "Enter the amount received.", path: ["amount"] })
  .transform(({ amount, ...v }) => ({ ...v, amountCents: amount }));
export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;

export const adminNotesSchema = z.object({ id: z.uuid(), notes: optionalText(5000) });

/** Charge or waive VAT on one booking (e.g. no VAT for a friend). */
export const bookingVatSchema = z.object({ id: z.uuid(), chargeVat: z.boolean() });
