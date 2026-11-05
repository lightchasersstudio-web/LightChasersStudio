import type { PublicSettings } from "@/server/queries/public";

/**
 * Questions for the FAQ page, grouped. Answers can use the studio settings
 * (deposit %, hold time…) so they stay correct when you change them in admin.
 *
 * `draft: true` = a question only the studio can answer (your policies). Drafts
 * show on your own computer (`npm run dev`) marked "needs your answer", and are
 * hidden on the live site. To publish one: write the answer and delete `draft`.
 */
export type FaqItem = {
  question: string;
  answer: string;
  /** Optional button under the answer. */
  link?: { href: string; label: string };
  draft?: true;
};
export type FaqGroup = { title: string; items: FaqItem[] };

type Settings = Pick<
  PublicSettings,
  "default_deposit_percent" | "vat_percent" | "hold_minutes" | "max_advance_days" | "city"
>;

export function faqGroups(s: Settings): FaqGroup[] {
  return [
    {
      title: "Booking",
      items: [
        {
          question: "How do I book a session?",
          answer:
            "Tap “Book now”, choose a package, pick an open date and time, add a few details about your shoot, then pay the deposit online. It takes about two minutes, and only times that are still free are shown.",
          link: { href: "/book", label: "Book now" },
        },
        {
          question: "How far ahead can I book?",
          answer: `You can book up to ${s.max_advance_days} days ahead. For dates further out, message us and we'll see what we can do.`,
        },
        {
          question: "Is my booking confirmed as soon as I pay?",
          answer:
            "Your deposit holds the time for you straight away. We then review the booking and confirm it, and we'll get in touch if anything needs to change.",
        },
        {
          question: "How do I check my booking later?",
          answer:
            "Enter your booking reference and the email you booked with on the “Find your booking” page. You'll see the date, time and status.",
          link: { href: "/booking", label: "Find your booking" },
        },
        {
          question: "Do you shoot outside the studio?",
          answer: `Yes. When you book, tell us the location: our studio, a venue, or any address in and around ${s.city}.`,
        },
      ],
    },
    {
      title: "Payment",
      items: [
        {
          question: "How much is the deposit?",
          answer: `Each booking shows its deposit before you pay. Usually it's ${s.default_deposit_percent}% of your total${s.vat_percent > 0 ? " (package, any add-ons and VAT)" : ""}, and the rest is paid to us separately.`,
        },
        ...(s.vat_percent > 0
          ? [
              {
                question: "Do your prices include VAT?",
                answer: `Package and add-on prices are shown before VAT. ${s.vat_percent}% VAT is added to your total when you book, and you'll see the full breakdown before you pay.`,
              },
            ]
          : []),
        {
          question: "How can I pay?",
          answer:
            "Deposits are paid securely through PayMongo, by scanning a QR Ph code with GCash, Maya or your bank app. We never see or store your payment details.",
        },
        {
          question: "What if I don't finish paying?",
          answer: `We hold your chosen time for ${s.hold_minutes} minutes while you pay. If the payment isn't completed, the time is released so someone else can book it, and you can simply start again.`,
        },
        {
          question: "Can I cancel and get my deposit back?",
          answer: "Write your cancellation and refund policy here.",
          draft: true,
        },
        {
          question: "Can I move my session to another date?",
          answer: "Write your rescheduling policy here (how much notice, any fee, how many times).",
          draft: true,
        },
      ],
    },
    {
      title: "Your photos",
      items: [
        {
          question: "When will I get my photos?",
          answer:
            "Write your usual delivery time here, and how photos are sent (e.g. online gallery).",
          draft: true,
        },
        {
          question: "How many edited photos will I get?",
          answer: "Write how many edited photos each kind of package includes.",
          draft: true,
        },
        {
          question: "What should we wear?",
          answer:
            "Comfortable, well-fitting outfits in two or three colours that go together work best. Solid colours and small textures photograph better than big logos or busy prints. Our preparation guide has more tips on outfits, what to bring and the day itself.",
          link: { href: "/prepare", label: "How to prepare for your shoot" },
        },
      ],
    },
    {
      title: "Privacy",
      items: [
        {
          question: "What do you do with my personal details?",
          answer:
            "We use your details only to arrange and look after your booking, under the Philippine Data Privacy Act of 2012 (RA 10173).",
        },
      ],
    },
  ];
}

const PREVIEW = process.env.NODE_ENV === "development";

/** The groups to show: drafts only in development, empty groups dropped. */
export function visibleFaq(s: Settings): FaqGroup[] {
  return faqGroups(s)
    .map((g) => ({ ...g, items: g.items.filter((i) => PREVIEW || !i.draft) }))
    .filter((g) => g.items.length > 0);
}
