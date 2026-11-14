import { describe, expect, it } from "vitest";

import { activityHref, describeActivity } from "./activity";

describe("describeActivity", () => {
  it("names what was done and to which item", () => {
    expect(describeActivity("service.update", { name: "Prenup Session" })).toBe(
      "Edited a package · Prenup Session",
    );
    expect(describeActivity("booking.confirmed", {}, "BK-2026-7C21E5")).toBe(
      "Confirmed the booking · BK-2026-7C21E5",
    );
    expect(describeActivity("booking.delete", { reference: "BK-2026-575AAF" })).toBe(
      "Deleted a booking · BK-2026-575AAF",
    );
    expect(describeActivity("settings.profile", {})).toBe("Updated the studio profile");
  });
});

describe("activityHref", () => {
  it("links to the item, but not to deleted ones", () => {
    expect(activityHref("booking.confirmed", "booking", "b1")).toBe("/admin/bookings/b1");
    expect(activityHref("booking.delete", "booking", "b1")).toBeNull();
    expect(activityHref("blackout.add", "blackout_dates", null)).toBe("/admin/availability");
    expect(activityHref("client.anonymise", "client", "c1")).toBe("/admin/clients/c1");
  });
});

describe("describeActivity: automatic deletion", () => {
  it("says how much was deleted, without names", () => {
    expect(describeActivity("privacy.auto_delete", { clients: 3, student_ids: 0 })).toBe(
      "Deleted 3 clients' details after the keeping period",
    );
    expect(describeActivity("privacy.auto_delete", { clients: 1, student_ids: 2 })).toBe(
      "Deleted 1 client's details after the keeping period, removed 2 student ID photos",
    );
    expect(describeActivity("privacy.auto_delete", { clients: 0, student_ids: 1 })).toBe(
      "Removed 1 student ID photo",
    );
  });
});
