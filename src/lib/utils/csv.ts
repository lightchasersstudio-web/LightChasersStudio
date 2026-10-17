/**
 * CSV that opens cleanly in Excel / Google Sheets: UTF-8 BOM (so ₱ shows right),
 * CRLF rows, quoted fields when needed. Text starting with = + - @ gets a leading
 * apostrophe so a client's name can't run as a spreadsheet formula.
 */
export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    if (v === null) return "";
    if (typeof v === "number") return String(v);
    const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
    return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
