import { z } from "zod";

import { intString, optionalText } from "@/lib/validations/shared";

/** Ways a client can ask to be contacted (no Viber, by the owner's choice). */
export const CONTACT_METHODS = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone call" },
  { value: "sms", label: "Text message (SMS)" },
  { value: "messenger", label: "Facebook Messenger" },
] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number]["value"];
const contactValues = CONTACT_METHODS.map((c) => c.value) as [ContactMethod, ...ContactMethod[]];

/** Most people one workshop sign-up can be for (owner decision 2026-10-28). */
export const WORKSHOP_MAX_PEOPLE = 3;

/** Version of the privacy notice the client agreed to (stored with their consent). */
export const CONSENT_VERSION = "2026-10";

const fullName = z.string().trim().min(2, "Enter your full name.").max(120);
const phone = z
  .string()
  .trim()
  .max(32)
  .refine((v) => /^[+\d][\d\s()-]*$/.test(v) && v.replace(/\D/g, "").length >= 7, {
    message: "Enter a phone number we can reach you on.",
  });
const messenger = optionalText(300);

/** Messenger as the preferred contact needs a name or profile link to reach them. */
const requireMessenger = (v: { preferredContact: ContactMethod; messenger: string | null }) =>
  v.preferredContact !== "messenger" || Boolean(v.messenger);
const messengerIssue = {
  message: "Add your Facebook name or Messenger link.",
  path: ["messenger"],
};

const clientFields = {
  fullName,
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  phone,
  preferredContact: z.enum(contactValues, "Pick how we should contact you."),
  messenger,
  consent: z.literal(true, "Please agree to the privacy notice to continue."),
};

export const clientDetailsSchema = z.object(clientFields).refine(requireMessenger, messengerIssue);
export type ClientDetailsInput = z.input<typeof clientDetailsSchema>;

const shootFields = {
  location: optionalText(300),
  participants: intString(1, 10_000),
  specialRequests: optionalText(2000),
};

export const shootDetailsSchema = z.object(shootFields);
export type ShootDetailsInput = z.input<typeof shootDetailsSchema>;

export const publicBookingSchema = z
  .object({
    ...clientFields,
    ...shootFields,
    serviceId: z.uuid("Pick a package."),
    addOnIds: z.array(z.uuid()).max(20),
    startAt: z.iso.datetime({ offset: true, message: "Pick a date and time." }),
    turnstileToken: z.string().max(4096),
    // Honeypot: hidden from people, filled in by bots.
    website: z.string().max(0),
    // Workshops only: pay the full price (else half), after accepting the refund rule.
    payInFull: z.boolean().optional(),
    refundRuleAccepted: z.boolean().optional(),
    // Workshops only: each person's name for their certificate (2+ people).
    attendees: z.array(z.string().trim().max(120)).max(WORKSHOP_MAX_PEOPLE).optional(),
  })
  .refine(requireMessenger, messengerIssue)
  .refine((v) => v.payInFull === undefined || v.refundRuleAccepted === true, {
    message: "Please confirm you understand the refund rule.",
    path: ["refundRuleAccepted"],
  })
  .superRefine((v, ctx) => {
    if (v.payInFull === undefined) return; // not a workshop
    if (v.participants > WORKSHOP_MAX_PEOPLE) {
      ctx.addIssue({
        code: "custom",
        message: `A workshop sign-up is for up to ${WORKSHOP_MAX_PEOPLE} people.`,
        path: ["participants"],
      });
      return;
    }
    if (v.participants === 1) return; // the certificate uses the booker's name
    for (let i = 0; i < v.participants; i++) {
      if ((v.attendees?.[i] ?? "").length < 2) {
        ctx.addIssue({
          code: "custom",
          message: "Enter their full name for the certificate.",
          path: ["attendees", i],
        });
      }
    }
  });
export type PublicBookingInput = z.input<typeof publicBookingSchema>;

export const lookupSchema = z.object({
  reference: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^BK-\d{4}-[0-9A-F]{6}$/, "Enter the reference from your email, like BK-2026-1A2B3C."),
  email: z.email("Enter the email you booked with.").trim().toLowerCase(),
});
export type LookupInput = z.input<typeof lookupSchema>;
