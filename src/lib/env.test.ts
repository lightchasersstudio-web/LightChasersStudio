import { describe, expect, it } from "vitest";

import { publicEnvSchema } from "@/lib/env";
import { serverEnvSchema } from "@/lib/env.server";

const validPublic = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

describe("env schemas", () => {
  it("accepts a valid public env", () => {
    expect(publicEnvSchema.parse(validPublic)).toMatchObject(validPublic);
  });

  it("rejects a malformed Supabase URL", () => {
    expect(() =>
      publicEnvSchema.parse({ ...validPublic, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" }),
    ).toThrow();
  });

  it("requires the service role key on the server and defaults the timezone", () => {
    expect(() => serverEnvSchema.parse(validPublic)).toThrow();
    const env = serverEnvSchema.parse({ ...validPublic, SUPABASE_SERVICE_ROLE_KEY: "srk" });
    expect(env.BUSINESS_TIMEZONE).toBe("Asia/Manila");
  });
});
