import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { createElement } from "react";
import { z } from "zod";

import { cutoffLabel, parseCutoff } from "@/lib/payroll/cutoff";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { assertAdmin } from "@/server/auth";
import { loadBrand, pdfResponse } from "@/server/pdf/kit";
import { PayslipsDocument } from "@/server/pdf/payslips";
import { getSavedPayroll } from "@/server/queries/payroll";

/**
 * GET /admin/payroll/pdf?cutoff=YYYY-MM-01|16[&employee=<id>] — the saved
 * payslips of a cut-off (all of them, a page each, or one employee's).
 * Only saved payrolls print, so a PDF always matches what was saved. Admins only.
 */
export async function GET(req: Request) {
  if (!(await assertAdmin())) return new Response("Not allowed", { status: 401 });
  const params = new URL(req.url).searchParams;
  const cutoff = parseCutoff(params.get("cutoff"));
  if (!cutoff) return new Response("Use ?cutoff=YYYY-MM-01 or YYYY-MM-16", { status: 400 });
  const employee = params.get("employee");
  if (employee !== null && !z.uuid().safeParse(employee).success) {
    return new Response("Not found", { status: 404 });
  }

  const [saved, brand] = await Promise.all([getSavedPayroll(cutoff), loadBrand()]);
  if (!saved) return new Response("Save this cut-off's payroll first.", { status: 404 });
  const payslips = employee
    ? saved.payslips.filter((p) => p.employee_id === employee)
    : saved.payslips;
  if (!payslips.length) return new Response("Not found", { status: 404 });

  const period = cutoffLabel(cutoff);
  const savedAt = format(new TZDate(saved.savedAt, BUSINESS_TZ), "d MMM yyyy, h:mm a");
  const name = payslips.length === 1 ? `payslip-${payslips[0]!.employee_name}` : "payslips";

  return pdfResponse(
    createElement(PayslipsDocument, { brand, payslips, period, saved: savedAt }),
    `${name}-${cutoff.start}.pdf`,
  );
}
