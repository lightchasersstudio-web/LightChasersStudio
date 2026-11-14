import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AdminOnly } from "@/components/admin/admin-only";

/** Old "Time record → By day" links: the day sheet now lives on the Payroll page. */
export default function DtrDayPage({ searchParams }: PageProps<"/admin/dtr/day">) {
  return (
    <Suspense>
      <AdminOnly>
        <Redirect searchParams={searchParams} />
      </AdminOnly>
    </Suspense>
  );
}

async function Redirect({
  searchParams,
}: Pick<PageProps<"/admin/dtr/day">, "searchParams">): Promise<React.ReactNode> {
  const { date } = await searchParams;
  redirect(typeof date === "string" ? `/admin/payroll?date=${date}` : "/admin/payroll");
}
