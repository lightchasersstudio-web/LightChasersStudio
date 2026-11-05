import { describe, expect, it } from "vitest";

import { fillFaqTokens, groupFaqs } from "./faq";

const settings = {
  default_deposit_percent: 30,
  vat_percent: 12,
  hold_minutes: 20,
  max_advance_days: 180,
  city: "Zamboanga City",
  business_name: "Light Chasers Studio",
};

describe("FAQ", () => {
  it("fills setting placeholders and leaves unknown ones", () => {
    expect(
      fillFaqTokens(
        "{deposit_percent}% deposit, {vat_percent}% VAT, held {hold_minutes} min",
        settings,
      ),
    ).toBe("30% deposit, 12% VAT, held 20 min");
    expect(fillFaqTokens("Book {max_advance_days} days ahead in {city}", settings)).toBe(
      "Book 180 days ahead in Zamboanga City",
    );
    expect(fillFaqTokens("Hi {name}", settings)).toBe("Hi {name}");
  });

  it("groups by topic in page order, keeping each question's order", () => {
    const groups = groupFaqs([
      { id: "c", topic: "payment", sort_order: 2 },
      { id: "a", topic: "booking", sort_order: 5 },
      { id: "b", topic: "payment", sort_order: 1 },
    ]);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ["Booking", ["a"]],
      ["Payment", ["b", "c"]],
    ]);
  });
});
