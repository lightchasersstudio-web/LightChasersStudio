/**
 * PayMongo checkout `payment_method_types` (docs.paymongo.com → Create a Checkout
 * Session) with the names clients see. Only methods activated on the PayMongo
 * account may be offered, or PayMongo refuses the whole checkout, so the live
 * list comes from PAYMONGO_PAYMENT_METHODS.
 */
export const PAYMENT_METHOD_LABELS = {
  qrph: "QR Ph (scan with GCash, Maya or any bank app)",
  gcash: "GCash",
  paymaya: "Maya",
  card: "card",
  grab_pay: "GrabPay",
  shopee_pay: "ShopeePay",
  billease: "BillEase",
  dob: "BPI online banking",
  dob_ubp: "UnionBank online banking",
  brankas_bdo: "BDO",
  brankas_landbank: "Landbank",
  brankas_metrobank: "Metrobank",
} as const;

export type PaymentMethod = keyof typeof PAYMENT_METHOD_LABELS;

export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as [
  PaymentMethod,
  ...PaymentMethod[],
];

/** "GCash, Maya or card" */
export function paymentMethodsText(methods: readonly PaymentMethod[]): string {
  return new Intl.ListFormat("en", { type: "disjunction" }).format(
    methods.map((m) => PAYMENT_METHOD_LABELS[m]),
  );
}
