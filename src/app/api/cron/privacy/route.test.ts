import { beforeEach, describe, expect, it, vi } from "vitest";

const env = { CRON_SECRET: "cron-secret" as string | undefined };
const purge = vi.fn();

vi.mock("@/lib/env.server", () => ({ getServerEnv: () => env }));
vi.mock("@/server/privacy", () => ({ purgeExpiredPersonalData: purge }));

const { GET } = await import("./route");

const call = (auth?: string) =>
  GET(
    new Request("http://localhost/api/cron/privacy", {
      headers: auth ? { authorization: auth } : {},
    }),
  );

beforeEach(() => {
  env.CRON_SECRET = "cron-secret";
  purge.mockReset().mockResolvedValue({ clients: 2, studentIds: 1, failed: 0 });
});

describe("privacy cron", () => {
  it("runs the clean-up for Vercel's cron call", async () => {
    const res = await call("Bearer cron-secret");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ clients: 2, studentIds: 1, failed: 0 });
    expect(purge).toHaveBeenCalledTimes(1);
  });

  it("refuses anyone else", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect(purge).not.toHaveBeenCalled();
  });

  it("does nothing until the secret is set", async () => {
    env.CRON_SECRET = undefined;
    expect((await call("Bearer cron-secret")).status).toBe(503);
    expect(purge).not.toHaveBeenCalled();
  });
});
