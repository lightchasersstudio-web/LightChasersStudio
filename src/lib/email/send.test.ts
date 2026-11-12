import { beforeEach, describe, expect, it, vi } from "vitest";

const env: Record<string, string | undefined> = {};
const sendMail = vi.fn();
const fetchMock = vi.fn();

vi.mock("@/lib/env.server", () => ({ getServerEnv: () => env }));
vi.mock("@/lib/payments/mock", () => ({ paymentsMockEnabled: () => false }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));
vi.stubGlobal("fetch", fetchMock);

const { sendEmail } = await import("./send");
const email = { to: "client@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi" };

describe("sendEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(env)) delete env[k];
  });

  it("sends from the studio Gmail when it's set up", async () => {
    Object.assign(env, {
      GMAIL_USER: "studio@gmail.com",
      GMAIL_APP_PASSWORD: "x",
      RESEND_API_KEY: "re_1",
    });
    await sendEmail(email);
    expect(sendMail).toHaveBeenCalledWith({
      from: '"Light Chasers Studio" <studio@gmail.com>',
      ...email,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never throws when Gmail fails", async () => {
    Object.assign(env, { GMAIL_USER: "studio@gmail.com", GMAIL_APP_PASSWORD: "x" });
    sendMail.mockRejectedValueOnce(new Error("bad password"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(sendEmail(email)).resolves.toBeUndefined();
  });

  it("falls back to Resend without Gmail", async () => {
    Object.assign(env, { RESEND_API_KEY: "re_1", EMAIL_FROM: "a@b.co" });
    fetchMock.mockResolvedValueOnce({ ok: true });
    await sendEmail(email);
    expect(sendMail).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
