import type { MetadataRoute } from "next";

/** "Add to Home Screen" name and icon (the logo's camera emblem). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Light Chasers Studio",
    short_name: "Light Chasers",
    description: "Photography in Zamboanga City. Book your session online.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF8F4",
    theme_color: "#455D5A",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
