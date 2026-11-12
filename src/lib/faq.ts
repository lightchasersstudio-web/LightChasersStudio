/** FAQ topics, in the order they appear on /faq (matches the faqs.topic check). */
export const FAQ_TOPICS = [
  { value: "booking", label: "Booking" },
  { value: "payment", label: "Payment" },
  { value: "photos", label: "Your photos" },
  { value: "workshops", label: "Workshops" },
  { value: "privacy", label: "Privacy" },
  { value: "other", label: "Other questions" },
] as const;
export type FaqTopic = (typeof FAQ_TOPICS)[number]["value"];
export const FAQ_TOPIC_VALUES = FAQ_TOPICS.map((t) => t.value) as [FaqTopic, ...FaqTopic[]];
export const faqTopicLabel = (topic: string) =>
  FAQ_TOPICS.find((t) => t.value === topic)?.label ?? topic;

/** Placeholders an answer can use; filled from the studio settings on the page. */
export const FAQ_TOKENS = [
  { token: "{deposit_percent}", meaning: "default deposit %" },
  { token: "{vat_percent}", meaning: "VAT %" },
  { token: "{hold_minutes}", meaning: "minutes a time is held while paying" },
  { token: "{max_advance_days}", meaning: "how many days ahead clients can book" },
  { token: "{city}", meaning: "your city" },
  { token: "{business_name}", meaning: "studio name" },
] as const;

export type FaqSettings = {
  default_deposit_percent: number;
  vat_percent: number;
  hold_minutes: number;
  max_advance_days: number;
  city: string;
  business_name: string;
};

/** "{deposit_percent}% of your total" → "30% of your total". Unknown {words} stay as typed. */
export function fillFaqTokens(text: string, s: FaqSettings): string {
  const values: Record<string, string> = {
    deposit_percent: String(s.default_deposit_percent),
    vat_percent: String(s.vat_percent),
    hold_minutes: String(s.hold_minutes),
    max_advance_days: String(s.max_advance_days),
    city: s.city,
    business_name: s.business_name,
  };
  return text.replace(/\{([a-z_]+)\}/g, (match, key: string) => values[key] ?? match);
}

/** Questions grouped by topic, topics in FAQ_TOPICS order, questions in their own order. */
export function groupFaqs<T extends { topic: string; sort_order: number }>(items: T[]) {
  return FAQ_TOPICS.map((t) => ({
    topic: t.value,
    label: t.label,
    items: items.filter((i) => i.topic === t.value).sort((a, b) => a.sort_order - b.sort_order),
  })).filter((g) => g.items.length > 0);
}
