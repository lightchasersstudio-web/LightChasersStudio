/** Cache tags for public catalogue data: public "use cache" queries tag with these, admin actions expire them. */
export const TAGS = {
  services: "services",
  portfolio: "portfolio",
  settings: "settings",
  availability: "availability",
  bookings: "bookings",
  reviews: "reviews",
  addOns: "add-ons",
} as const;
