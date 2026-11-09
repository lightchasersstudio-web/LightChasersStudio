import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { createElement } from "react";
import { z } from "zod";

import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { assertAdmin } from "@/server/auth";
import { EmployeeDetailsDocument } from "@/server/pdf/employee-details";
import { loadBrand, loadEmployeePhotos, pdfResponse } from "@/server/pdf/kit";
import { getContributionRates, getEmployee } from "@/server/queries/employees";

/** GET /admin/employees/[id]/pdf — one employee's details. Admins only. */
export async function GET(_req: Request, { params }: RouteContext<"/admin/employees/[id]/pdf">) {
  if (!(await assertAdmin())) return new Response("Not allowed", { status: 401 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404 });

  const [employee, rates, brand] = await Promise.all([
    getEmployee(id),
    getContributionRates(),
    loadBrand(),
  ]);
  if (!employee) return new Response("Not found", { status: 404 });
  const photos = await loadEmployeePhotos(employee.photo_path ? [employee.photo_path] : []);
  const printed = `Printed ${format(new TZDate(new Date(), BUSINESS_TZ), "d MMM yyyy")}`;

  return pdfResponse(
    createElement(EmployeeDetailsDocument, {
      brand,
      employees: [employee],
      photos,
      rates,
      printed,
    }),
    `${employee.full_name}-details.pdf`,
  );
}
