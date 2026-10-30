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

/** Workshop price categories (owner decision 2026-10-28). */
export const ATTENDEE_CATEGORIES = [
  { value: "regular", label: "Regular" },
  { value: "early_bird", label: "Early bird" },
  { value: "student", label: "Student" },
] as const;
export type AttendeeCategory = (typeof ATTENDEE_CATEGORIES)[number]["value"];
const ATTENDEE_CATEGORY_VALUES = ATTENDEE_CATEGORIES.map((c) => c.value) as [
  AttendeeCategory,
  ...AttendeeCategory[],
];

/** A student ID upload in the private `student-ids` bucket: "<uuid>.webp" or ".jpg". */
export const STUDENT_ID_PATH = /^[0-9a-f-]{36}\.(webp|jpg)$/;

/** Version of the privacy notice the client agreed to (stored with their consent). */
export const CONSENT_VERSION = "2026-10-30";
/** When the privacy policy (/privacy) last changed; shown on the page. */
export const PRIVACY_UPDATED = "30 October 2026";

const fullName = z.string().trim().min(2, "Enter your full name.").max(120);
/** A number we can call or text: digits, spaces, ( ) - and a leading +, 7+ digits. */
const isPhone = (v: string) => /^[+\d][\d\s()-]*$/.test(v) && v.replace(/\D/g, "").length >= 7;
const phone = z.string().trim().max(32).refine(isPhone, {
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
    // Workshops only: each person's certificate name and price category (a
    // student also uploads their ID; `idPath` is the uploaded file).
    attendees: z
      .array(
        z.object({
          name: z.string().trim().max(120),
          // Their own contact details, so the studio can reach each person.
          phone: z.string().trim().max(32),
          address: z.string().trim().max(300),
          category: z.enum(ATTENDEE_CATEGORY_VALUES),
          idPath: z.string().regex(STUDENT_ID_PATH).or(z.literal("")),
        }),
      )
      .max(WORKSHOP_MAX_PEOPLE)
      .optional(),
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
    for (let i = 0; i < v.participants; i++) {
      const person = v.attendees?.[i];
      if ((person?.name ?? "").length < 2) {
        ctx.addIssue({
          code: "custom",
          message: "Enter their full name for the certificate.",
          path: ["attendees", i, "name"],
        });
      }
      if (!isPhone(person?.phone ?? "")) {
        ctx.addIssue({
          code: "custom",
          message: "Enter their mobile number.",
          path: ["attendees", i, "phone"],
        });
      }
      if ((person?.address ?? "").length < 5) {
        ctx.addIssue({
          code: "custom",
          message: "Enter their address.",
          path: ["attendees", i, "address"],
        });
      }
      if (person?.category === "student" && !person.idPath) {
        ctx.addIssue({
          code: "custom",
          message: "Upload a photo of their student ID.",
          path: ["attendees", i, "idPath"],
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
