import { Suspense } from "react";

import { MobileBookBar } from "@/components/public/mobile-book-bar";
import { WorkshopButton } from "@/components/public/workshop-button";
import { HideAfter } from "@/components/shared/hide-after";
import { getActiveWorkshop } from "@/server/queries/public";

/** The floating "Workshop" pill (wider screens), shown while a workshop is active and not over. */
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

/** The phone "Book now" bar, which also links to an active workshop. */
export async function SiteBookBar() {
  const workshop = await getActiveWorkshop();
  return (
    <MobileBookBar
      workshop={workshop ? { name: workshop.name, endsAt: workshop.workshop_ends_at } : null}
    />
  );
}
