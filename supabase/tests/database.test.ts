/**
 * Database tests: RLS, the booking RPC and double-booking prevention.
 *
 * Runs against a real Supabase Postgres (the hosted DEV project) via
 * DATABASE_URL_TEST, e.g. the session-pooler connection string for `postgres`.
 * Every test runs inside a transaction that is rolled back, so nothing persists.
 * Skipped when DATABASE_URL_TEST is not set.   Run with: npm run test:db
 */
import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import { Pool, type PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const url = process.env.DATABASE_URL_TEST;
const TZ = "Asia/Manila";

type DbRole = "anon" | "authenticated" | "service_role";

const pool = url ? new Pool({ connectionString: url, max: 2 }) : undefined;

afterAll(async () => {
  await pool?.end();
});

async function inRollback(fn: (c: PoolClient) => Promise<void>) {
  const c = await pool!.connect();
  try {
    await c.query("begin");
    await fn(c);
  } finally {
    await c.query("rollback");
    c.release();
  }
}

/** Switch the current transaction to a Supabase API role (optionally as a user). */
async function actAs(c: PoolClient, role: DbRole, userId?: string) {
  const claims = JSON.stringify({ role, ...(userId ? { sub: userId } : {}) });
  await c.query("select set_config('request.jwt.claims', $1, true)", [claims]);
  await c.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
  await c.query(`set local role ${role}`);
}

/** Run a statement that must fail; returns the error message. */
async function expectFailure(c: PoolClient, sql: string, params: unknown[] = []) {
  await c.query("savepoint expect_failure");
  try {
    await c.query(sql, params);
  } catch (error) {
    await c.query("rollback to savepoint expect_failure");
    return (error as Error).message;
  }
  throw new Error(`expected failure but succeeded: ${sql}`);
}

/** Deterministic fixtures, created as the table owner inside the test transaction. */
async function setupFixtures(c: PoolClient, capacity = 1) {
  await c.query(`update public.business_settings
    set timezone = '${TZ}', min_notice_hours = 48, max_advance_days = 180,
        slot_interval_minutes = 30, buffer_minutes = 30, default_deposit_percent = 30, hold_minutes = 20,
        max_concurrent_bookings = ${capacity}
    where id`);
  await c.query("delete from public.availability_rules");
  await c.query("delete from public.blackout_dates");
  await c.query(`insert into public.availability_rules (day_of_week, start_time, end_time)
    select d, '08:00', '19:00' from generate_series(0, 6) d`);

  const { rows } = await c.query<{ id: string; slug: string }>(`
    insert into public.services (name, slug, category, duration_minutes, price_cents, deposit_cents, is_active)
    values
      ('Test Portrait', 'test-portrait', 'portrait', 60, 350000, null, true),
      ('Test Wedding', 'test-wedding', 'wedding', 120, 1000000, 200000, true),
      ('Test Free Consult', 'test-free-consult', 'portrait', 30, 0, null, true),
      ('Test Hidden', 'test-hidden', 'event', 60, 100000, null, false)
    returning id, slug`);
  const id = (slug: string) => rows.find((r) => r.slug === slug)!.id;
  return {
    portrait: id("test-portrait"),
    wedding: id("test-wedding"),
    free: id("test-free-consult"),
    hidden: id("test-hidden"),
  };
}

/** A local Manila time N days from now (well past the 48h notice). */
function manila(daysAhead: number, hour: number, minute = 0) {
  const base = addDays(TZDate.tz(TZ), daysAhead);
  return new TZDate(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute, TZ);
}

const CREATE = `select * from public.create_booking(
  p_full_name => $1, p_email => $2, p_phone => $3, p_preferred_contact => 'email',
  p_consent_version => 'v1', p_service_id => $4, p_start_at => $5)`;

function book(
  c: PoolClient,
  serviceId: string,
  start: Date,
  email = "ana@example.com",
  name = "Ana Cruz",
) {
  return c.query<{
    booking_id: string;
    reference_code: string;
    status: string;
    deposit_cents: number;
    hold_expires_at: Date | null;
  }>(CREATE, [name, email, "09171234567", serviceId, start.toISOString()]);
}

const ADMIN_CREATE = `select * from public.admin_create_booking(
  p_full_name => $1, p_email => $2, p_phone => '09171234567', p_preferred_contact => 'phone',
  p_messenger => null, p_service_id => $3, p_start_at => $4, p_price_cents => $5,
  p_allow_outside_hours => $6, p_location => null, p_participants => 1, p_special_requests => null,
  p_payment_provider => $7, p_payment_amount_cents => $8, p_payment_reference => null,
  p_admin_id => null)`;

function adminBook(
  c: PoolClient,
  serviceId: string,
  start: Date,
  opts: {
    email?: string | null;
    price?: number;
    allowOutside?: boolean;
    pay?: [string, number];
  } = {},
) {
  return c.query<{ booking_id: string; reference_code: string }>(ADMIN_CREATE, [
    "Walk In",
    opts.email === undefined ? "walkin@example.com" : opts.email,
    serviceId,
    start.toISOString(),
    opts.price ?? 350000,
    opts.allowOutside ?? false,
    opts.pay?.[0] ?? null,
    opts.pay?.[1] ?? null,
  ]);
}

const PAID = "select * from public.mark_booking_paid($1, $2, $3, $4, '{}'::jsonb)";

describe.skipIf(!url)("database (RLS + booking rules)", () => {
  describe("row level security", () => {
    it("anon reads active services only and cannot see private tables", async () => {
      await inRollback(async (c) => {
        const s = await setupFixtures(c);
        await actAs(c, "service_role");
        await book(c, s.portrait, manila(10, 10));

        await actAs(c, "anon");
        const services = await c.query("select slug from public.services where slug like 'test-%'");
        expect(services.rows.map((r) => r.slug).sort()).toEqual(
          ["test-free-consult", "test-portrait", "test-wedding"].sort(),
        );
        for (const table of ["clients", "bookings", "payments", "audit_logs", "admin_profiles"]) {
          const { rows } = await c.query(`select * from public.${table}`);
          expect(rows, table).toHaveLength(0);
        }
      });
    });

    it("anon cannot write bookings directly or call create_booking", async () => {
      await inRollback(async (c) => {
        const s = await setupFixtures(c);
        await actAs(c, "anon");
        expect(
          await expectFailure(c, CREATE, [
            "X Y",
            "x@example.com",
            "09171234567",
            s.portrait,
            manila(10, 10).toISOString(),
          ]),
        ).toMatch(/permission denied/);
        expect(
          await expectFailure(
            c,
            `insert into public.bookings (reference_code, client_id, service_id, start_at, end_at, blocked_until,
               contact_name, contact_phone, preferred_contact, price_cents, deposit_cents, hold_expires_at)
             values ('BK-2026-ABCDEF', gen_random_uuid(), $1, now(), now() + interval '1 hour', now() + interval '1 hour',
               'X Y', '09171234567', 'email', 0, 0, now())`,
            [s.portrait],
          ),
        ).toMatch(/row-level security/);
        // RLS silently filters UPDATEs to zero rows for non-admins.
        const updated = await c.query(
          "update public.services set price_cents = 1 where id = $1 returning id",
          [s.portrait],
        );
        expect(updated.rows).toHaveLength(0);
      });
    });

    it("anon can read busy ranges without any personal data", async () => {
      await inRollback(async (c) => {
        const s = await setupFixtures(c);
        const start = manila(10, 10);
        await actAs(c, "service_role");
        await book(c, s.portrait, start);

        await actAs(c, "anon");
        const { rows, fields } = await c.query("select * from public.get_busy_ranges($1, $2)", [
          manila(9, 0).toISOString(),
          manila(12, 0).toISOString(),
        ]);
        expect(fields.map((f) => f.name)).toEqual(["start_at", "blocked_until"]);
        expect(rows).toHaveLength(1);
        expect(new Date(rows[0].start_at).getTime()).toBe(start.getTime());
      });
    });

    it("admins can read bookings; other signed-in users cannot", async () => {
      await inRollback(async (c) => {
        const s = await setupFixtures(c);
        const adminId = crypto.randomUUID();
        const userId = crypto.randomUUID();
        await c.query(
          "insert into auth.users (id, email) values ($1, 'admin@test.local'), ($2, 'user@test.local')",
          [adminId, userId],
        );
        await c.query("insert into public.admin_profiles (user_id, role) values ($1, 'owner')", [
          adminId,
        ]);
        await actAs(c, "service_role");
        await book(c, s.portrait, manila(10, 10));

        await actAs(c, "authenticated", userId);
        expect((await c.query("select id from public.bookings")).rows).toHaveLength(0);
        expect((await c.query("select id from public.clients")).rows).toHaveLength(0);

        await c.query("reset role");
        await actAs(c, "authenticated", adminId);
        expect((await c.query("select id from public.bookings")).rows).toHaveLength(1);
        expect((await c.query("select id from public.clients")).rows).toHaveLength(1);
      });
    });

    it("shows only published reviews publicly; only admins can write them", async () => {
      await inRollback(async (c) => {
        const adminId = crypto.randomUUID();
        const userId = crypto.randomUUID();
        await c.query(
          "insert into auth.users (id, email) values ($1, 'admin@test.local'), ($2, 'user@test.local')",
          [adminId, userId],
        );
        await c.query("insert into public.admin_profiles (user_id, role) values ($1, 'owner')", [
          adminId,
        ]);
        await c.query("delete from public.reviews");
        await c.query(`insert into public.reviews (name, category, shoot, quote, is_published)
          values ('Shown', 'wedding', 'Prenup', 'A lovely published review.', true),
                 ('Draft', 'portrait', 'Family', 'A review not shown yet.', false)`);
        const insert = `insert into public.reviews (name, category, shoot, quote)
          values ('Fake', 'event', 'Party', 'Five stars from myself.')`;

        await actAs(c, "anon");
        expect((await c.query("select name from public.reviews")).rows).toEqual([
          { name: "Shown" },
        ]);
        expect(await expectFailure(c, insert)).toMatch(/row-level security/);

        await c.query("reset role");
        await actAs(c, "authenticated", userId);
        expect((await c.query("select name from public.reviews")).rows).toHaveLength(1);
        expect(await expectFailure(c, insert)).toMatch(/row-level security/);
        await c.query("update public.reviews set is_published = true");
        await c.query("delete from public.reviews");

        await c.query("reset role");
        await actAs(c, "authenticated", adminId);
        // The signed-in non-admin's update and delete above touched nothing.
        expect((await c.query("select name from public.reviews order by name")).rows).toEqual([
          { name: "Draft" },
          { name: "Shown" },
        ]);
        await c.query(insert);
        expect((await c.query("select id from public.reviews")).rows).toHaveLength(3);
      });
    });
  });

  describe("create_booking", () => {
    it("creates a held booking with a server-computed deposit", async () => {
      await inRollback(async (c) => {
        const s = await setupFixtures(c);
        await actAs(c, "service_role");

        const portrait = (await book(c, s.portrait, manila(10, 10))).rows[0]!;
        expect(portrait.status).toBe("pending_payment");
        expect(portrait.deposit_cents).toBe(105000); // 30% of 350,000
        expect(portrait.reference_code).toMatch(/^BK-\d{4}-[0-9A-F]{6}$/);
        expect(portrait.hold_expires_at).not.toBeNull();

        const wedding = (await book(c, s.wedding, manila(11, 10), "bea@example.com")).rows[0]!;
        expect(wedding.deposit_cents).toBe(200000); // explicit service deposit wins

        const free = (await book(c, s.free, manila(12, 10), "cy@example.com")).rows[0]!;
        expect(free.status).toBe("pending");
        expect(free.hold_expires_at).toBeNull();
      });
    });

    it("adds add-on prices to the total and deposit, and keeps a copy on the booking", async () => {
      await inRollback(async (c) => {
        const s = await setupFixtures(c);
        const { rows: addOns } = await c.query<{ id: string; name: string }>(`
          insert into public.add_ons (name, price_cents, is_active, sort_order) values
            ('Test Extra Photographer', 200000, true, 0),
            ('Test Videographer', 500000, true, 1),
            ('Test Hidden Extra', 100000, false, 2)
          returning id, name`);
        const id = (name: string) => addOns.find((a) => a.name === name)!.id;
        const both = [id("Test Extra Photographer"), id("Test Videographer")];

        await actAs(c, "anon");
        const visible = await c.query("select name from public.add_ons where name like 'Test %'");
        expect(visible.rows.map((r) => r.name).sort()).toEqual([
          "Test Extra Photographer",
          "Test Videographer",
        ]);

        await c.query("reset role");
        await actAs(c, "service_role");
        const withExtras = `select * from public.create_booking(
          p_full_name => 'Ana Cruz', p_email => $1, p_phone => '09171234567',
          p_preferred_contact => 'email', p_consent_version => 'v1', p_service_id => $2,
          p_start_at => $3, p_add_on_ids => $4)`;

        // Default 30% deposit applies to package + add-ons: (350,000 + 700,000) × 30%.
        const portrait = (
          await c.query(withExtras, [
            "ana@example.com",
            s.portrait,
            manila(10, 10).toISOString(),
            [...both, both[0]], // a repeated id counts once
          ])
        ).rows[0]!;
        expect(portrait.deposit_cents).toBe(315000);
        const booking = await c.query("select price_cents from public.bookings where id = $1", [
          portrait.booking_id,
        ]);
        expect(booking.rows[0].price_cents).toBe(1050000);
        const copies = await c.query(
          "select name, price_cents from public.booking_add_ons where booking_id = $1 order by name",
          [portrait.booking_id],
        );
        expect(copies.rows).toEqual([
          { name: "Test Extra Photographer", price_cents: 200000 },
          { name: "Test Videographer", price_cents: 500000 },
        ]);

        // A package's fixed deposit stays fixed.
        const wedding = (
          await c.query(withExtras, [
            "bea@example.com",
            s.wedding,
            manila(11, 10).toISOString(),
            both,
          ])
        ).rows[0]!;
        expect(wedding.deposit_cents).toBe(200000);

        expect(
          await expectFailure(c, withExtras, [
            "cy@example.com",
            s.portrait,
            manila(12, 10).toISOString(),
            [id("Test Hidden Extra")],
          ]),
        ).toMatch(/add_on_unavailable/);

        await c.query("reset role");
        await actAs(c, "anon");
        expect((await c.query("select id from public.booking_add_ons")).rows).toHaveLength(0);
      });
    });

    it("prevents overlapping bookings, including the buffer", async () => {
      await inRollback(async (c) => {
        const s = await setupFixtures(c);
        await actAs(c, "service_role");
        await book(c, s.portrait, manila(10, 10)); // 10:00–11:00, blocked until 11:30

        const params = (start: Date) => [
          "Other",
          "other@example.com",
          "09170000000",
          s.portrait,
          start.toISOString(),
        ];
        expect(await expectFailure(c, CREATE, params(manila(10, 10, 30)))).toMatch(
          /slot_unavailable/,
        );
        expect(await expectFailure(c, CREATE, params(manila(10, 11)))).toMatch(/slot_unavailable/); // inside buffer
        expect(await expectFailure(c, CREATE, params(manila(10, 9, 30)))).toMatch(
          /slot_unavailable/,
        ); // its own buffer overlaps
        await expect(
          book(c, s.portrait, manila(10, 11, 30), "other@example.com"),
        ).resolves.toBeDefined();
      });
    });

    it("frees the slot when a booking is cancelled or its hold expires", async () => {
      await inRollback(async (c) => {
        const s = await setupFixtures(c);
        await actAs(c, "service_role");
        const first = (await book(c, s.portrait, manila(10, 10))).rows[0]!;

        await c.query("update public.bookings set status = 'cancelled' where id = $1", [
          first.booking_id,
        ]);
        const second = (await book(c, s.portrait, manila(10, 10), "b@example.com")).rows[0]!;

        // Simulate a lapsed hold, then a new booking for the same slot succeeds.
        await c.query(
          "update public.bookings set hold_expires_at = now() - interval '1 minute' where id = $1",
          [second.booking_id],
        );
        await expect(book(c, s.portrait, manila(10, 10), "c@example.com")).resolves.toBeDefined();
        const { rows } = await c.query("select status from public.bookings where id = $1", [
          second.booking_id,
        ]);
        expect(rows[0].status).toBe("expired");
      });
    });

    it("enforces business rules", async () => {
      await inRollback(async (c) => {
        const s = await setupFixtures(c);
        const blackout = manila(20, 10);
        await c.query("insert into public.blackout_dates (date) values ($1)", [
          `${blackout.getFullYear()}-${String(blackout.getMonth() + 1).padStart(2, "0")}-${String(blackout.getDate()).padStart(2, "0")}`,
        ]);
        await actAs(c, "service_role");
        const attempt = (serviceId: string, start: Date) =>
          expectFailure(c, CREATE, [
            "Ana Cruz",
            "ana@example.com",
            "09171234567",
            serviceId,
            start.toISOString(),
          ]);

        expect(await attempt(s.hidden, manila(10, 10))).toMatch(/service_unavailable/);
        expect(await attempt(s.portrait, manila(1, 10))).toMatch(/too_soon/);
        expect(await attempt(s.portrait, manila(400, 10))).toMatch(/too_far/);
        expect(await attempt(s.portrait, manila(10, 10, 15))).toMatch(/invalid_start_time/);
        expect(await attempt(s.portrait, manila(10, 7))).toMatch(/outside_business_hours/);
        expect(await attempt(s.portrait, manila(10, 18, 30))).toMatch(/outside_business_hours/); // ends 19:30
        expect(await attempt(s.portrait, blackout)).toMatch(/blackout_date/);
      });
    });

    it("never lets a public submission overwrite an existing client's details", async () => {
      await inRollback(async (c) => {
        const s = await setupFixtures(c);
        await actAs(c, "service_role");
        await book(c, s.portrait, manila(10, 10), "Ana@Example.com", "Ana Cruz");
        await book(c, s.portrait, manila(11, 10), "ana@example.com", "Impostor");

        const clients = await c.query(
          "select full_name, email from public.clients where email = 'ana@example.com'",
        );
        expect(clients.rows).toEqual([{ full_name: "Ana Cruz", email: "ana@example.com" }]);
        const names = await c.query("select contact_name from public.bookings order by start_at");
        expect(names.rows.map((r) => r.contact_name)).toEqual(["Ana Cruz", "Impostor"]);
      });
    });
  });

  it("replaces the weekly schedule atomically, admins only", async () => {
    await inRollback(async (c) => {
      await setupFixtures(c);
      const adminId = crypto.randomUUID();
      const userId = crypto.randomUUID();
      await c.query(
        "insert into auth.users (id, email) values ($1, 'admin@test.local'), ($2, 'user@test.local')",
        [adminId, userId],
      );
      await c.query("insert into public.admin_profiles (user_id, role) values ($1, 'admin')", [
        adminId,
      ]);
      const week = JSON.stringify([
        { day_of_week: 1, start_time: "09:00", end_time: "12:00" },
        { day_of_week: 1, start_time: "13:00", end_time: "18:00" },
      ]);

      await actAs(c, "authenticated", userId);
      expect(
        await expectFailure(c, "select public.replace_availability_rules($1::jsonb)", [week]),
      ).toMatch(/forbidden/);

      await c.query("reset role");
      await actAs(c, "authenticated", adminId);
      await c.query("select public.replace_availability_rules($1::jsonb)", [week]);
      const { rows } = await c.query(
        "select day_of_week, start_time::text from public.availability_rules order by start_time",
      );
      expect(rows).toEqual([
        { day_of_week: 1, start_time: "09:00:00" },
        { day_of_week: 1, start_time: "13:00:00" },
      ]);

      // A bad window fails the whole call and leaves the saved week untouched.
      const bad = JSON.stringify([{ day_of_week: 2, start_time: "18:00", end_time: "09:00" }]);
      await expectFailure(c, "select public.replace_availability_rules($1::jsonb)", [bad]);
      expect((await c.query("select 1 from public.availability_rules")).rows).toHaveLength(2);
    });
  });

  it("rejects invalid status transitions", async () => {
    await inRollback(async (c) => {
      const s = await setupFixtures(c);
      await actAs(c, "service_role");
      const b = (await book(c, s.portrait, manila(10, 10))).rows[0]!;
      expect(
        await expectFailure(c, "update public.bookings set status = 'completed' where id = $1", [
          b.booking_id,
        ]),
      ).toMatch(/invalid booking status transition/);
      await c.query("update public.bookings set status = 'pending' where id = $1", [b.booking_id]);
      const { rows } = await c.query("select hold_expires_at from public.bookings where id = $1", [
        b.booking_id,
      ]);
      expect(rows[0].hold_expires_at).toBeNull();
    });
  });
  describe("capacity (several shoots at once)", () => {
    it("allows up to max_concurrent_bookings at the same time", async () => {
      await inRollback(async (c) => {
        const s = await setupFixtures(c, 2);
        await actAs(c, "service_role");
        await book(c, s.portrait, manila(10, 10), "a@example.com");
        await book(c, s.portrait, manila(10, 10), "b@example.com");
        const third = [
          "Cy",
          "c@example.com",
          "09170000000",
          s.portrait,
          manila(10, 10).toISOString(),
        ];
        expect(await expectFailure(c, CREATE, third)).toMatch(/slot_unavailable/);
      });
    });

    it("counts only bookings that actually coincide", async () => {
      await inRollback(async (c) => {
        const s = await setupFixtures(c, 2);
        await actAs(c, "service_role");
        // 10:00-11:00 (+30 buffer) and 12:00-13:00 (+30) never overlap each other.
        await book(c, s.portrait, manila(10, 10), "a@example.com");
        await book(c, s.portrait, manila(10, 12), "b@example.com");
        // A 2h wedding 10:30-12:30 (+30) overlaps both, but only one at any instant.
        await expect(
          book(c, s.wedding, manila(10, 10, 30), "c@example.com"),
        ).resolves.toBeDefined();
        // 10:30-11:30 now has two at once, so a third booking there is refused.
        const fourth = [
          "Di",
          "d@example.com",
          "09170000000",
          s.portrait,
          manila(10, 11).toISOString(),
        ];
        expect(await expectFailure(c, CREATE, fourth)).toMatch(/slot_unavailable/);
      });
    });

    it("serialises booking creation so two requests can't both take the last spot", async () => {
      // Session A checks capacity and keeps its transaction open; session B's check
      // must wait for A (advisory lock), so B can't count before A's booking exists.
      const range = "now() + interval '10 days', now() + interval '10 days 1 hour'";
      const a = await pool!.connect();
      const b = await pool!.connect();
      try {
        await a.query("begin");
        await a.query(`select public.assert_capacity(${range})`);
        await b.query("begin");
        await b.query("set local lock_timeout = '1s'");
        await expect(b.query(`select public.assert_capacity(${range})`)).rejects.toThrow(
          /lock timeout/,
        );
      } finally {
        await a.query("rollback");
        await b.query("rollback");
        a.release();
        b.release();
      }
    });
  });

  describe("admin_create_booking", () => {
    it("skips the notice rule, warns outside hours, and never exceeds capacity", async () => {
      await inRollback(async (c) => {
        const s = await setupFixtures(c, 1);
        await actAs(c, "service_role");
        // Tomorrow is too soon for the public, fine for staff.
        const created = (await adminBook(c, s.portrait, manila(1, 10))).rows[0]!;
        const { rows } = await c.query(
          "select status, source, hold_expires_at from public.bookings where id = $1",
          [created.booking_id],
        );
        expect(rows[0]).toEqual({ status: "confirmed", source: "admin", hold_expires_at: null });

        const late = manila(3, 20); // 20:00, after the 19:00 closing
        const args = (allow: boolean) => [
          "Walk In",
          null,
          s.portrait,
          late.toISOString(),
          350000,
          allow,
          null,
          null,
        ];
        expect(await expectFailure(c, ADMIN_CREATE, args(false))).toMatch(/outside_business_hours/);
        await expect(
          adminBook(c, s.portrait, late, { email: null, allowOutside: true }),
        ).resolves.toBeDefined();
        // Same slot again with capacity 1: refused even with the override.
        expect(await expectFailure(c, ADMIN_CREATE, args(true))).toMatch(/slot_unavailable/);
      });
    });

    it("works without an email, uses the custom price and records a cash payment", async () => {
      await inRollback(async (c) => {
        const s = await setupFixtures(c, 2);
        await actAs(c, "service_role");
        const b = (
          await adminBook(c, s.portrait, manila(5, 10), {
            email: null,
            price: 200000,
            pay: ["cash", 50000],
          })
        ).rows[0]!;
        const { rows } = await c.query(
          `select b.price_cents, b.deposit_cents, cl.email, p.provider, p.amount_cents, p.status
           from public.bookings b join public.clients cl on cl.id = b.client_id
           join public.payments p on p.booking_id = b.id where b.id = $1`,
          [b.booking_id],
        );
        expect(rows).toEqual([
          {
            price_cents: 200000,
            deposit_cents: 60000,
            email: null,
            provider: "cash",
            amount_cents: 50000,
            status: "paid",
          },
        ]);
      });
    });
  });

  describe("mark_booking_paid (PayMongo webhook)", () => {
    it("flags money that lands on a cancelled or already-paid booking", async () => {
      await inRollback(async (c) => {
        const s = await setupFixtures(c, 2);
        await actAs(c, "service_role");
        const cancelled = (await book(c, s.portrait, manila(10, 10), "a@example.com")).rows[0]!;
        await c.query("update public.bookings set status = 'cancelled' where id = $1", [
          cancelled.booking_id,
        ]);
        const late = await c.query(PAID, [cancelled.reference_code, "cs_c", "pay_c", 105000]);
        expect(late.rows[0].outcome).toBe("needs_review");

        const paid = (await book(c, s.portrait, manila(11, 10), "b@example.com")).rows[0]!;
        await c.query(PAID, [paid.reference_code, "cs_p1", "pay_p1", 105000]);
        const twice = await c.query(PAID, [paid.reference_code, "cs_p2", "pay_p2", 105000]);
        expect(twice.rows[0].outcome).toBe("needs_review");

        const { rows } = await c.query(
          "select status, needs_refund_review from public.bookings where id = any($1) order by start_at",
          [[cancelled.booking_id, paid.booking_id]],
        );
        expect(rows).toEqual([
          { status: "cancelled", needs_refund_review: true },
          { status: "pending", needs_refund_review: true },
        ]);
      });
    });

    it("settles a held booking once, even when the event repeats", async () => {
      await inRollback(async (c) => {
        const s = await setupFixtures(c);
        await actAs(c, "service_role");
        const b = (await book(c, s.portrait, manila(10, 10))).rows[0]!;
        const first = await c.query(PAID, [b.reference_code, "cs_1", "pay_1", 105000]);
        expect(first.rows[0].outcome).toBe("paid");
        const again = await c.query(PAID, [b.reference_code, "cs_1", "pay_1", 105000]);
        expect(again.rows[0].outcome).toBe("duplicate");
        const { rows } = await c.query(
          `select b.status, count(p.*)::int as payments from public.bookings b
           join public.payments p on p.booking_id = b.id where b.id = $1 group by b.status`,
          [b.booking_id],
        );
        expect(rows).toEqual([{ status: "pending", payments: 1 }]);
      });
    });

    it("keeps a late payment but flags it when the slot has filled up", async () => {
      await inRollback(async (c) => {
        const s = await setupFixtures(c, 1);
        await actAs(c, "service_role");
        const lapsed = (await book(c, s.portrait, manila(10, 10), "a@example.com")).rows[0]!;
        await c.query(
          "update public.bookings set hold_expires_at = now() - interval '1 minute' where id = $1",
          [lapsed.booking_id],
        );
        await book(c, s.portrait, manila(10, 10), "b@example.com"); // expires `lapsed`, takes the slot

        const { rows } = await c.query(PAID, [lapsed.reference_code, "cs_9", "pay_9", 105000]);
        expect(rows[0].outcome).toBe("needs_review");
        const after = await c.query(
          "select status, needs_refund_review from public.bookings where id = $1",
          [lapsed.booking_id],
        );
        expect(after.rows[0]).toEqual({ status: "pending", needs_refund_review: true });
      });
    });
  });

  it("keeps the new functions away from anon and signed-in users", async () => {
    await inRollback(async (c) => {
      await setupFixtures(c);
      for (const role of ["anon", "authenticated"] as const) {
        await actAs(c, role);
        for (const sql of [
          "select public.hit_rate_limit('k', 5, 60)",
          "select * from public.mark_booking_paid('BK-2026-ABCDEF', 'cs', 'pay', 1, '{}'::jsonb)",
          "select public.assert_capacity(now(), now() + interval '1 hour')",
          `select * from public.admin_create_booking('A B', null, '0917000000', 'phone', null,
             gen_random_uuid(), now(), 1, true, null, 1, null, null, null, null, null)`,
        ]) {
          expect(await expectFailure(c, sql), `${role}: ${sql}`).toMatch(/permission denied/);
        }
        await c.query("reset role");
      }
    });
  });

  it("hit_rate_limit allows N hits per window, then blocks", async () => {
    await inRollback(async (c) => {
      await actAs(c, "service_role");
      const hit = async () =>
        (await c.query("select public.hit_rate_limit('test:ip', 3, 600) as ok")).rows[0].ok;
      expect([await hit(), await hit(), await hit(), await hit()]).toEqual([
        true,
        true,
        true,
        false,
      ]);
    });
  });
});
