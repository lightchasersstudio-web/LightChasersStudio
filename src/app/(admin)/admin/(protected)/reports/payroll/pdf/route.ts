import { format, parseISO } from "date-fns";
import { createElement } from "react";

import {
  DAILY_PAYROLL_NOTE,
  parseDailyPayrollFilter,
  parseReportDate,
} from "@/lib/payroll/daily-report";
import { assertAdmin } from "@/server/auth";
import { DailyPayrollDocument } from "@/server/pdf/daily-payroll";
import { loadBrand, pdfResponse } from "@/server/pdf/kit";
import { getDailyPayroll } from "@/server/queries/daily-payroll";

/**
 * GET /admin/reports/payroll/pdf?date=YYYY-MM-DD[&category=events|photobooth|studio|none]
 * — the daily payroll (Sales report → Payroll) as a PDF to print or save. Admins only.
 */
export async function GET(req: Request) {
  if (!(await assertAdmin())) return new Response("Not allowed", { status: 401 });
  const params = new URL(req.url).searchParams;
  const date = parseReportDate(params.get("date"));
  if (!date) return new Response("Use ?date=YYYY-MM-DD", { status: 400 });
  const filter = parseDailyPayrollFilter(params.get("category"));

  const [report, brand] = await Promise.all([getDailyPayroll(date, filter), loadBrand()]);
  if (!report.hasRecords) return new Response("Nothing recorded for this day.", { status: 404 });

  return pdfResponse(
    createElement(DailyPayrollDocument, {
      brand,
      report,
      dayLabel: format(parseISO(date), "EEE d MMM yyyy"),
      note: DAILY_PAYROLL_NOTE,
    }),
    `daily-payroll-${date}${filter === "all" ? "" : `-${filter}`}.pdf`,
  );
}
