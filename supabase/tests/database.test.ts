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
async function setupFixtures(c: PoolClient) {
  await c.query(`update public.business_settings
    set timezone = '${TZ}', min_notice_hours = 48, max_advance_days = 180,
        slot_interval_minutes = 30, buffer_minutes = 30, default_deposit_percent = 30, hold_minutes = 20
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
});
