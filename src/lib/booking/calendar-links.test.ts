import { describe, expect, it } from "vitest";

import { googleCalendarUrl, icsFile, type CalendarEvent } from "./calendar-links";

const event: CalendarEvent = {
  reference: "BK-2026-ABC123",
  title: "Family Portrait · Light Chasers Studio",
  startAt: "2026-11-03T05:00:00.000Z",
  endAt: "2026-11-03T06:00:00.000Z",
  location: "Pasonanca Park, Zamboanga City",
};

describe("calendar links", () => {
  it("builds a Google Calendar link in UTC with the reference", () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.searchParams.get("dates")).toBe("20261103T050000Z/20261103T060000Z");
    expect(url.searchParams.get("text")).toBe(event.title);
    expect(url.searchParams.get("details")).toContain("BK-2026-ABC123");
    expect(url.searchParams.get("location")).toBe(event.location);
  });

  it("builds a valid .ics file with escaped text and a day-before reminder", () => {
    const ics = icsFile(event, new Date("2026-10-16T00:00:00Z"));
    const lines = ics.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("DTSTART:20261103T050000Z");
    expect(lines).toContain("DTEND:20261103T060000Z");
    expect(lines).toContain("LOCATION:Pasonanca Park\\, Zamboanga City");
    expect(lines).toContain("TRIGGER:-P1D");
    expect(lines.at(-1)).toBe("END:VCALENDAR");
  });

  it("leaves out the location when there is none", () => {
    expect(icsFile({ ...event, location: null })).not.toContain("LOCATION");
    expect(
      new URL(googleCalendarUrl({ ...event, location: null })).searchParams.has("location"),
    ).toBe(false);
  });
});
