import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { createElement } from "react";
import { z } from "zod";

import { cutoffLabel, parseCutoff } from "@/lib/payroll/cutoff";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/server/auth";
import { cutoffEnded, syncPayroll } from "@/server/payroll-sync";
import { loadBrand, pdfResponse } from "@/server/pdf/kit";
import { PayslipsDocument } from "@/server/pdf/payslips";
import { getSavedPayroll } from "@/server/queries/payroll";

/**
 * GET /admin/payroll/pdf?cutoff=YYYY-MM-01|16[&employee=<id>] — a cut-off's
 * payslips (all of them, a page each, or one employee's). Printing saves them
 * first while the cut-off is still running (or was never saved), so a PDF
 * always matches what is saved. A finished cut-off prints as saved. Admins only.
 */
export async function GET(req: Request) {
  const admin = await assertAdmin();
  if (!admin) return new Response("Not allowed", { status: 401 });
  const params = new URL(req.url).searchParams;
  const cutoff = parseCutoff(params.get("cutoff"));
  if (!cutoff) return new Response("Use ?cutoff=YYYY-MM-01 or YYYY-MM-16", { status: 400 });
  const employee = params.get("employee");
  if (employee !== null && !z.uuid().safeParse(employee).success) {
    return new Response("Not found", { status: 404 });
  }

  let saved = await getSavedPayroll(cutoff);
  if (!saved || !cutoffEnded(cutoff)) {
    await syncPayroll(cutoff, { admin, supabase: await createClient() });
    saved = await getSavedPayroll(cutoff);
  }
  if (!saved) return new Response("No one to pay in this cut-off.", { status: 404 });
  const brand = await loadBrand();
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
