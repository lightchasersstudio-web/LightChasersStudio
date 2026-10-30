import { describe, expect, it } from "vitest";

import { reviewSchema, type ReviewFormInput } from "./reviews";

const review: ReviewFormInput = {
  name: "  Maria & Jun ",
  category: "wedding",
  shoot: "Prenup session",
  quote: "  They made us feel so relaxed the whole day.  ",
  rating: "5",
  isPublished: true,
};

describe("reviewSchema", () => {
  it("maps form strings to a DB row", () => {
    expect(reviewSchema.parse(review)).toEqual({
      name: "Maria & Jun",
      category: "wedding",
      shoot: "Prenup session",
      quote: "They made us feel so relaxed the whole day.",
      rating: 5,
      is_published: true,
    });
  });

  it("treats an empty rating as no stars", () => {
    expect(reviewSchema.parse({ ...review, rating: "" }).rating).toBeNull();
  });

  it("rejects a missing quote, a bad rating or an unknown category", () => {
    expect(reviewSchema.safeParse({ ...review, quote: "Nice" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...review, rating: "6" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...review, category: "pets" }).success).toBe(false);
  });
});
