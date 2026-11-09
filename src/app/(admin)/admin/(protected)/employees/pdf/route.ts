import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { createElement } from "react";

import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { assertAdmin } from "@/server/auth";
import { EmployeeDetailsDocument } from "@/server/pdf/employee-details";
import { loadBrand, loadEmployeePhotos, pdfResponse } from "@/server/pdf/kit";
import { getContributionRates, listEmployeeDetails } from "@/server/queries/employees";

/** GET /admin/employees/pdf[?status=inactive] — every active (or inactive) employee, a page each. Admins only. */
export async function GET(req: Request) {
  if (!(await assertAdmin())) return new Response("Not allowed", { status: 401 });
  const status = new URL(req.url).searchParams.get("status") === "inactive" ? "inactive" : "active";

  const [employees, rates, brand] = await Promise.all([
    listEmployeeDetails(status),
    getContributionRates(),
    loadBrand(),
  ]);
  if (!employees.length) return new Response("No employees to print.", { status: 404 });
  const photos = await loadEmployeePhotos(
    employees.flatMap((e) => (e.photo_path ? [e.photo_path] : [])),
  );
  const printed = `Printed ${format(new TZDate(new Date(), BUSINESS_TZ), "d MMM yyyy")}`;

  return pdfResponse(
    createElement(EmployeeDetailsDocument, { brand, employees, photos, rates, printed }),
    `staff-details-${status}.pdf`,
  );
}
