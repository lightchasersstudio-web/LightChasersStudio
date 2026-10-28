import { describe, expect, it } from "vitest";

import { clientDetailsSchema, publicBookingSchema, shootDetailsSchema } from "./booking";

const details = {
  fullName: "  Ana Cruz ",
  email: "Ana@Example.com",
  phone: "0917 123 4567",
  preferredContact: "messenger",
  messenger: "https://m.me/ana.cruz",
  consent: true,
};
const shoot = { location: "", participants: "4", specialRequests: "" };

describe("clientDetailsSchema", () => {
  it("cleans up what the client typed", () => {
    expect(clientDetailsSchema.parse(details)).toMatchObject({
      fullName: "Ana Cruz",
      email: "ana@example.com",
      messenger: "https://m.me/ana.cruz",
    });
  });

  it("requires privacy consent", () => {
    const r = clientDetailsSchema.safeParse({ ...details, consent: false });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.path).toEqual(["consent"]);
  });

  it("does not offer Viber", () => {
    expect(clientDetailsSchema.safeParse({ ...details, preferredContact: "viber" }).success).toBe(
      false,
    );
  });

  it("needs a Messenger name when Messenger is the preferred contact", () => {
    const r = clientDetailsSchema.safeParse({ ...details, messenger: "" });
    expect(r.error!.issues[0]!.path).toEqual(["messenger"]);
  });

  it("rejects a phone number without enough digits", () => {
    expect(clientDetailsSchema.safeParse({ ...details, phone: "12-34" }).success).toBe(false);
  });
});

describe("shootDetailsSchema", () => {
  it("turns blanks into nulls and the head count into a number", () => {
    expect(shootDetailsSchema.parse(shoot)).toEqual({
      location: null,
      participants: 4,
      specialRequests: null,
    });
  });
});

describe("publicBookingSchema", () => {
  const input = {
    ...details,
    ...shoot,
    serviceId: "0f8fad5b-d9cb-469f-a165-70867728950e",
    addOnIds: [],
    startAt: "2026-11-03T05:00:00.000Z",
    turnstileToken: "",
    website: "",
  };

  it("accepts a complete booking", () => {
    expect(publicBookingSchema.safeParse(input).success).toBe(true);
  });

  it("rejects bots that fill the hidden website field", () => {
    expect(publicBookingSchema.safeParse({ ...input, website: "spam.example" }).success).toBe(
      false,
    );
  });

  describe("workshops", () => {
    const ID = "0f8fad5b-d9cb-469f-a165-70867728950e.webp";
    const person = (name: string, category = "regular", idPath = "") => ({
      name,
      category,
      idPath,
    });
    const workshop = {
      ...input,
      participants: "1",
      attendees: [person("Ana Cruz")],
      payInFull: true,
      refundRuleAccepted: true,
    };
    const paths = (v: object) =>
      publicBookingSchema.safeParse(v).error?.issues.map((i) => i.path.join(".")) ?? [];

    it("needs the refund rule accepted", () => {
      expect(paths({ ...workshop, refundRuleAccepted: false })).toEqual(["refundRuleAccepted"]);
      expect(paths(workshop)).toEqual([]);
    });

    it("allows up to 3 people", () => {
      expect(paths({ ...workshop, participants: "4" })).toEqual(["participants"]);
    });

    it("needs a certificate name for everyone coming", () => {
      expect(
        paths({
          ...workshop,
          participants: "3",
          attendees: [person("Ana Cruz"), person(" "), person("B")],
        }),
      ).toEqual(["attendees.1.name", "attendees.2.name"]);
      expect(paths({ ...workshop, participants: "2" })).toEqual(["attendees.1.name"]);
    });

    it("needs an uploaded ID for each student", () => {
      expect(paths({ ...workshop, attendees: [person("Ana Cruz", "student")] })).toEqual([
        "attendees.0.idPath",
      ]);
      expect(paths({ ...workshop, attendees: [person("Ana Cruz", "student", ID)] })).toEqual([]);
      // Only paths the server hands out are accepted.
      expect(
        paths({ ...workshop, attendees: [person("Ana Cruz", "student", "../other.webp")] }),
      ).toEqual(["attendees.0.idPath"]);
      expect(paths({ ...workshop, attendees: [person("Ana Cruz", "vip")] })).toEqual([
        "attendees.0.category",
      ]);
    });

    it("ignores the people limit on packages", () => {
      expect(paths({ ...input, participants: "12" })).toEqual([]);
    });
  });
});
