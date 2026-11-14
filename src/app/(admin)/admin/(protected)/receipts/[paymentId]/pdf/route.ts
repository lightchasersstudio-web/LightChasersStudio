import { createElement } from "react";
import { z } from "zod";

import { assertAdmin } from "@/server/auth";
import { loadBrand, pdfResponse } from "@/server/pdf/kit";
import { ReceiptDocument } from "@/server/pdf/receipt";
import { loadReceipt, receiptFileName } from "@/server/receipts";

/** GET /admin/receipts/[paymentId]/pdf — one paid payment's receipt (policy 1.5). Admins only. */
export async function GET(
  _req: Request,
  { params }: RouteContext<"/admin/receipts/[paymentId]/pdf">,
) {
  if (!(await assertAdmin())) return new Response("Not allowed", { status: 401 });
  const { paymentId } = await params;
  if (!z.uuid().safeParse(paymentId).success) return new Response("Not found", { status: 404 });

  // loadReceipt uses the service role; access was checked just above.
  const [receipt, brand] = await Promise.all([loadReceipt(paymentId), loadBrand()]);
  if (!receipt) return new Response("Not found", { status: 404 });
  return pdfResponse(
    createElement(ReceiptDocument, { brand, receipt: receipt.data }),
    receiptFileName(receipt.data.number),
  );
}
