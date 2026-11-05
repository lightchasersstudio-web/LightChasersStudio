import { describe, expect, it } from "vitest";

import { isGoogleMapsUrl, messengerUrl, studioMapsUrl } from "./social";

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

describe("Google Maps links", () => {
  it("accepts Google Maps share and place links", () => {
    for (const url of [
      "https://maps.app.goo.gl/AbC123xyz",
      "https://www.google.com/maps/place/Light+Chasers+Studio/@6.92,122.07,17z",
      "https://maps.google.com/?cid=123",
      "https://goo.gl/maps/AbC123",
      "https://g.page/lightchasers",
    ]) {
      expect(isGoogleMapsUrl(url), url).toBe(true);
    }
  });

  it("refuses other links", () => {
    for (const url of [
      "http://maps.app.goo.gl/AbC",
      "https://www.google.com/search?q=studio",
      "https://evil.com/maps",
      "https://maps.google.com.evil.com/x",
      "not a link",
    ]) {
      expect(isGoogleMapsUrl(url), url).toBe(false);
    }
  });

  it("opens the studio's pin when set, else searches by name and address", () => {
    const s = {
      maps_url: null,
      business_name: "Light Chasers Studio",
      address: "3rd floor, MPO Building Tetuan",
      city: "Zamboanga City",
    };
    expect(studioMapsUrl(s)).toBe(
      "https://www.google.com/maps/search/?api=1&query=Light%20Chasers%20Studio%2C%203rd%20floor%2C%20MPO%20Building%20Tetuan",
    );
    expect(studioMapsUrl({ ...s, maps_url: "https://maps.app.goo.gl/x" })).toBe(
      "https://maps.app.goo.gl/x",
    );
  });
});
