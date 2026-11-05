import "server-only";

import { PAGE_SIZE, searchTerm, type ListFilters } from "@/lib/admin/list-filters";
import { createClient } from "@/lib/supabase/server";

export type ClientRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  bookingCount: number;
  lastShootAt: string | null;
  paidCents: number;
};

/** One page of clients, newest first, with booking counts and money received (RLS: admins only). */
export async function listClients(
  filters: ListFilters,
): Promise<{ rows: ClientRow[]; total: number }> {
  const supabase = await createClient();
  let query = supabase.from("clients").select("id, full_name, email, phone", { count: "exact" });
  const term = searchTerm(filters.q);
  if (term) {
    query = query.or(`full_name.ilike.*${term}*,email.ilike.*${term}*,phone.ilike.*${term}*`);
  }
  const start = (filters.page - 1) * PAGE_SIZE;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(start, start + PAGE_SIZE - 1);
  if (error) throw error;

  const ids = data.map((c) => c.id);
  const { data: bookings, error: bookingsError } = ids.length
    ? await supabase
        .from("bookings")
        .select("client_id, start_at, payments(amount_cents, status)")
        .in("client_id", ids)
    : { data: [], error: null };
  if (bookingsError) throw bookingsError;

  return {
    rows: data.map((c) => {
      const own = bookings.filter((b) => b.client_id === c.id);
      return {
        id: c.id,
        fullName: c.full_name,
        email: c.email,
        phone: c.phone,
        bookingCount: own.length,
        lastShootAt:
          own
            .map((b) => b.start_at)
            .sort()
            .at(-1) ?? null,
        paidCents: own
          .flatMap((b) => b.payments)
          .filter((p) => p.status === "paid")
          .reduce((sum, p) => sum + p.amount_cents, 0),
      };
    }),
    total: count ?? 0,
  };
}

export type AdminClient = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  preferredContact: string;
  consentGivenAt: string;
  consentVersion: string;
  createdAt: string;
  anonymised: boolean;
};

/** One client for the admin client page, or null (RLS: admins only). */
export async function getClientForAdmin(id: string): Promise<AdminClient | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, full_name, email, phone, preferred_contact, consent_given_at, consent_version, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    fullName: data.full_name,
    email: data.email,
    phone: data.phone,
    preferredContact: data.preferred_contact,
    consentGivenAt: data.consent_given_at,
    consentVersion: data.consent_version,
    createdAt: data.created_at,
    anonymised: data.consent_version === ANONYMISED,
  };
}

/** consent_version written by anonymise_client(), marking a client whose data was deleted. */
export const ANONYMISED = "anonymised";
