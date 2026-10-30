import { Suspense } from "react";

import { WorkshopButton } from "@/components/public/workshop-button";
import { HideAfter } from "@/components/shared/hide-after";
import { getActiveWorkshop } from "@/server/queries/public";

/** The left-hand "Workshop" button, shown while a workshop is active and not yet over. */
export async function SiteWorkshop() {
  const workshop = await getActiveWorkshop();
  // usePathname() in a shared layout needs a Suspense boundary (see nav-links.tsx).
  return workshop ? (
    <HideAfter until={workshop.workshop_ends_at}>
      <Suspense>
        <WorkshopButton name={workshop.name} />
      </Suspense>
    </HideAfter>
  ) : null;
}
