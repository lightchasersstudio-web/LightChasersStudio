"use client";

import { useMemo, useSyncExternalStore } from "react";

import { REFERENCE_RE } from "@/lib/booking/reference";

// Booking references remembered in this browser, so "Find your booking" can offer
// them. Only the reference, package and start time: no names, emails or prices.

const KEY = "lcs:my-bookings";
const MAX = 5;

export type SavedBooking = { reference: string; title: string | null; startAt: string | null };

const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): SavedBooking[] {
  try {
    const list = JSON.parse(raw ?? "[]") as unknown;
    return Array.isArray(list)
      ? list.filter(
          (b): b is SavedBooking =>
            typeof b === "object" && b !== null && REFERENCE_RE.test(String(b.reference)),
        )
      : [];
  } catch {
    return [];
  }
}

function write(list: SavedBooking[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // Private mode or storage blocked: nothing is remembered, which is fine.
  }
  listeners.forEach((l) => l());
}

/** Remembers a booking on this device (newest first; re-saving moves it to the top). */
export function saveBookingOnDevice(b: SavedBooking) {
  write([b, ...parse(read()).filter((x) => x.reference !== b.reference)]);
}

export function forgetBookingOnDevice(reference: string) {
  write(parse(read()).filter((x) => x.reference !== reference));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The bookings remembered on this device ([] on the server and before hydration). */
export function useSavedBookings(): SavedBooking[] {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return useMemo(() => parse(raw), [raw]);
}
