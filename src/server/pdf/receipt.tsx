import "server-only";

import { Document, Page, Text, View } from "@react-pdf/renderer";

import { C, PdfHeader, s, type Brand } from "@/server/pdf/kit";

/** Everything printed on one receipt, already formatted (see src/server/receipts.ts). */
export type ReceiptData = {
  number: string;
  paidOn: string;
  receivedFrom: string;
  amount: string;
  /** "Down payment", "Balance payment" or "Payment". */
  purpose: string;
  method: string;
  reference: string | null;
  bookingReference: string;
  packageName: string;
  when: string;
  total: string;
  paidToDate: string;
  balance: string;
};

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={[s.row, s.rule]}>
      <Text style={{ color: C.muted }}>{label}</Text>
      <Text style={[{ maxWidth: "65%", textAlign: "right" }, strong ? s.bold : {}]}>{value}</Text>
    </View>
  );
}

/** An acknowledgement receipt for one payment (A5, studio header). */
export function ReceiptDocument({ brand, receipt }: { brand: Brand; receipt: ReceiptData }) {
  return (
    <Document title={`Receipt ${receipt.number}`} author={brand.name}>
      <Page size="A5" style={s.page}>
        <PdfHeader brand={brand} title="Acknowledgement Receipt" subtitle={receipt.number} />

        <View
          style={{
            backgroundColor: C.blush,
            borderRadius: 8,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <Text style={s.small}>Received from</Text>
          <Text style={s.display}>{receipt.receivedFrom}</Text>
          <Text style={[s.small, { marginTop: 8 }]}>Amount received</Text>
          <Text style={[s.display, { fontSize: 22, color: C.evergreen }]}>{receipt.amount}</Text>
        </View>

        <Text style={s.h2}>Payment</Text>
        <Row label="Date paid" value={receipt.paidOn} />
        <Row label="For" value={receipt.purpose} />
        <Row label="Paid by" value={receipt.method} />
        {receipt.reference ? <Row label="Reference no." value={receipt.reference} /> : null}

        <Text style={[s.h2, { marginTop: 16 }]}>Booking</Text>
        <Row label="Booking reference" value={receipt.bookingReference} strong />
        <Row label="Package" value={receipt.packageName} />
        <Row label="When" value={receipt.when} />
        <Row label="Booking total" value={receipt.total} />
        <Row label="Paid so far (with this payment)" value={receipt.paidToDate} />
        <Row label="Balance" value={receipt.balance} strong />

        <Text style={[s.small, { marginTop: 18 }]}>
          Thank you! This acknowledges the payment above for your booking. It is not a BIR official
          receipt.
        </Text>
      </Page>
    </Document>
  );
}
