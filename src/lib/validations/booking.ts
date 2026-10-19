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
  })
  .refine(requireMessenger, messengerIssue);
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
