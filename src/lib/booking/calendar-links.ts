/** A shoot to save in the client's own calendar. */
export type CalendarEvent = {
  reference: string;
  title: string;
  startAt: string; // ISO
  endAt: string; // ISO
  location: string | null;
};

/** 2026-11-03T05:00:00.000Z → 20261103T050000Z */
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, "");

const details = (e: CalendarEvent) => `Booking reference: ${e.reference}`;

export function googleCalendarUrl(e: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(e.startAt)}/${stamp(e.endAt)}`,
    details: details(e),
    ctz: "Asia/Manila",
  });
  if (e.location) params.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Escapes text for an iCalendar property value (RFC 5545 §3.3.11). */
const icsText = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

/** An .ics file for Apple Calendar, Outlook and others, with a reminder the day before. */
export function icsFile(e: CalendarEvent, now = new Date()): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Light Chasers Studio//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.reference}@lightchasers.studio`,
    `DTSTAMP:${stamp(now.toISOString())}`,
    `DTSTART:${stamp(e.startAt)}`,
    `DTEND:${stamp(e.endAt)}`,
    `SUMMARY:${icsText(e.title)}`,
    `DESCRIPTION:${icsText(details(e))}`,
    ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(e.title)}`,
    "TRIGGER:-P1D",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
