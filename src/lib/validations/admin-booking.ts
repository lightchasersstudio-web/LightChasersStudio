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

/**
 * Add-ons staff put on a booking: from the catalog (addOnId) or a custom extra
 * (addOnId ""). Prices are editable; output matches the RPCs' p_add_ons jsonb.
 */
export const addOnLines = z
  .array(
    z.object({
      addOnId: z.union([z.literal(""), z.uuid()]),
      name: z.string().trim().min(2, "Name the add-on.").max(80),
      price: pesoString,
    }),
  )
  .max(20, "Up to 20 add-ons.")
  .transform((lines) =>
    lines.map((l) => ({ add_on_id: l.addOnId || null, name: l.name, price_cents: l.price })),
  );
export type AddOnLineInput = z.input<typeof addOnLines>[number];

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
    participants: intString(1, 10_000),
    specialRequests: optionalText(2000),
    deposit: z.enum(["gcash", "cash", "none"]),
    depositAmount: z.string(),
    gcashReference: optionalText(100),
    consent: z.literal(true, "Confirm the client agreed to the privacy notice."),
    allowOutsideHours: z.boolean(),
    addOns: addOnLines,
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
      addOns: v.addOns,
    };
  });

export type AdminBookingInput = z.input<typeof adminBookingSchema>;
export type AdminBookingValues = z.output<typeof adminBookingSchema>;

/** Staff changing an existing booking (time, package, price, add-ons, VAT, details). */
export const adminBookingEditSchema = z
  .object({
    bookingId: z.uuid(),
    serviceId: z.uuid("Pick a package."),
    date: dateString,
    time: timeString,
    price: pesoString,
    fullName: z.string().trim().min(2, "Enter the client's name.").max(120),
    phone: z.string().trim().min(7, "Enter a phone number.").max(32),
    preferredContact: z.enum(contactValues),
    messenger: optionalText(300),
    location: optionalText(300),
    participants: intString(1, 10_000),
    specialRequests: optionalText(2000),
    addOns: addOnLines,
    chargeVat: z.boolean(),
    emailClient: z.boolean(),
    allowOutsideHours: z.boolean(),
  })
  .refine((v) => v.preferredContact !== "messenger" || Boolean(v.messenger), {
    path: ["messenger"],
    message: "Add their Facebook name or link.",
  })
  .transform((v) => ({
    bookingId: v.bookingId,
    serviceId: v.serviceId,
    startAt: businessDateTimeToIso(v.date, v.time),
    packageCents: v.price,
    fullName: v.fullName,
    phone: v.phone,
    preferredContact: v.preferredContact,
    messenger: v.messenger,
    location: v.location,
    participants: v.participants,
    specialRequests: v.specialRequests,
    addOns: v.addOns,
    chargeVat: v.chargeVat,
    emailClient: v.emailClient,
    allowOutsideHours: v.allowOutsideHours,
  }));
export type AdminBookingEditInput = z.input<typeof adminBookingEditSchema>;

/** Owner deleting a booking: they type its reference to confirm. */
export const deleteBookingSchema = z
  .object({ id: z.uuid(), confirmReference: z.string().trim().toUpperCase() })
  .refine((v) => /^BK-\d{4}-[0-9A-F]{6}$/.test(v.confirmReference), {
    path: ["confirmReference"],
    message: "Type the booking reference exactly.",
  });

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

/** Accept or reject a workshop student's ID (a rejection is then handled by hand). */
export const reviewStudentIdSchema = z.object({
  attendeeId: z.uuid(),
  status: z.enum(["accepted", "rejected"]),
});
