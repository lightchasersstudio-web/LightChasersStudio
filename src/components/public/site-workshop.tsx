import { Suspense } from "react";

import { WorkshopButton } from "@/components/public/workshop-button";
import { getActiveWorkshop } from "@/server/queries/public";

/** The left-hand "Workshop" button, shown only while a workshop is open for sign-up. */
export async function SiteWorkshop() {
  const workshop = await getActiveWorkshop();
  // usePathname() in a shared layout needs a Suspense boundary (see nav-links.tsx).
  return workshop ? (
    <Suspense>
      <WorkshopButton name={workshop.name} />
    </Suspense>
  ) : null;
}
