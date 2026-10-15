import { describe, expect, it } from "vitest";

import { messengerUrl } from "./social";

describe("messengerUrl", () => {
  it("turns a Facebook page link into a Messenger chat link", () => {
    expect(messengerUrl("https://www.facebook.com/lightchasersstudio/")).toBe(
      "https://m.me/lightchasersstudio",
    );
    expect(messengerUrl("https://facebook.com/light.chasers")).toBe("https://m.me/light.chasers");
  });

  it("gives up on links it can't map to a page name", () => {
    expect(messengerUrl(null)).toBeNull();
    expect(messengerUrl("https://www.facebook.com/profile.php?id=123")).toBeNull();
    expect(messengerUrl("https://www.facebook.com/groups/abc")).toBeNull();
    expect(messengerUrl("https://example.com/lightchasersstudio")).toBeNull();
  });
});
