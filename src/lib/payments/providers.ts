/** How a payment was made, as staff and clients read it (payments.provider). */
export const PAYMENT_PROVIDER_LABELS: Record<string, string> = {
  paymongo: "Online (PayMongo)",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank transfer",
  cash: "Cash",
};

/** Ways staff record money received outside the website (studio policy 1.3). */
export const RECORDED_PROVIDERS = [
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "bank_transfer", label: "Bank transfer (InstaPay/PESONet)" },
  { value: "cash", label: "Cash" },
] as const;
export type RecordedProvider = (typeof RECORDED_PROVIDERS)[number]["value"];
export const RECORDED_PROVIDER_VALUES = RECORDED_PROVIDERS.map((p) => p.value) as [
  RecordedProvider,
  ...RecordedProvider[],
];

export const providerLabel = (provider: string) => PAYMENT_PROVIDER_LABELS[provider] ?? provider;

/** What a payment was for, on its receipt. */
export function paymentPurposeLabel(p: {
  provider: string;
  purpose: string;
  amountCents: number;
  totalCents: number;
}): string {
  if (p.provider !== "paymongo") return "Payment";
  if (p.purpose === "balance") return "Balance payment";
  return p.amountCents >= p.totalCents ? "Full payment" : "Down payment";
}
