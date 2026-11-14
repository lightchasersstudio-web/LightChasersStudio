import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  Font,
  Image,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
  type DocumentProps,
} from "@react-pdf/renderer";
import sharp from "sharp";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

// Shared bits for the payroll PDFs (A4, studio name and logo at the top).
// Fonts are bundled TTFs: the built-in PDF fonts have no ₱ sign.

const FONTS = path.join(process.cwd(), "src", "assets", "fonts");
let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  Font.register({
    family: "Nunito Sans",
    fonts: [
      { src: path.join(FONTS, "NunitoSans-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONTS, "NunitoSans-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({ family: "Fraunces", src: path.join(FONTS, "Fraunces-SemiBold.ttf") });
  Font.registerHyphenationCallback((word) => [word]); // never split words
  fontsReady = true;
}

/** Brand colours (globals.css), as hex for the PDF. */
export const C = {
  ink: "#1F2A28",
  muted: "#5F6B69",
  line: "#E4DED5",
  evergreen: "#455D5A",
  terracotta: "#A8513A",
  blush: "#F8E6DF",
  sage: "#E3F0E5",
  ivory: "#FAF8F4",
};

export const s = StyleSheet.create({
  page: {
    fontFamily: "Nunito Sans",
    fontSize: 10,
    color: C.ink,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    // No page-wide lineHeight: it stops react-pdf drawing the page numbers (render text).
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 14,
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  logo: { width: 52, height: 52, objectFit: "contain" },
  // Fraunces sits tall: give it a line height of its own so lines don’t overlap.
  studio: { fontFamily: "Fraunces", fontSize: 16, lineHeight: 1.25, color: C.evergreen },
  small: { fontSize: 8.5, color: C.muted },
  docTitle: { fontFamily: "Fraunces", fontSize: 13, lineHeight: 1.25, textAlign: "right" },
  h2: {
    fontFamily: "Fraunces",
    fontSize: 12,
    lineHeight: 1.25,
    marginBottom: 6,
    color: C.evergreen,
  },
  display: { fontFamily: "Fraunces", fontSize: 16, lineHeight: 1.3 },
  bold: { fontWeight: 700 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3.5 },
  rule: { borderBottomWidth: 0.75, borderBottomColor: C.line },
  footerNote: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 140,
    fontSize: 7.5,
    color: C.muted,
  },
  footerPage: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    textAlign: "right",
    fontSize: 7.5,
    color: C.muted,
  },
});

export type Brand = {
  name: string;
  contact: string;
  /** Small JPEG bytes (the PDF can't show WebP). */
  logo: Buffer | null;
};

/**
 * Studio name, contact line and logo (the uploaded one, else the bundled logo).
 * Pass a client when there's no signed-in admin (e.g. the payment webhook).
 */
export async function loadBrand(client?: SupabaseClient<Database>): Promise<Brand> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("business_settings")
    .select("business_name, address, city, phone, email, logo_path")
    .single();

  let logo: Buffer | null = null;
  if (data?.logo_path) {
    const { data: file } = await supabase.storage.from("brand").download(data.logo_path);
    if (file) logo = await toJpeg(Buffer.from(await file.arrayBuffer()), 200);
  }
  if (!logo) {
    const bundled = await readFile(path.join(process.cwd(), "public", "brand", "logo.jpg")).catch(
      () => null,
    );
    logo = bundled && (await toJpeg(bundled, 200));
  }
  return {
    name: data?.business_name ?? "Light Chasers Studio",
    contact: [data?.address ?? data?.city, data?.phone, data?.email].filter(Boolean).join(" · "),
    logo,
  };
}

/**
 * Any image → a small JPEG for the PDF (on white, since JPEG has no
 * transparency); null if it can't be read. Keeps files small: the logo is on
 * every page.
 */
export async function toJpeg(bytes: Buffer, size: number): Promise<Buffer | null> {
  try {
    return await sharp(bytes)
      .resize(size, size, { fit: "inside" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    return null;
  }
}

/** Staff photos from the private bucket as small JPEGs, by path. */
export async function loadEmployeePhotos(paths: string[]): Promise<Map<string, Buffer>> {
  const photos = new Map<string, Buffer>();
  if (!paths.length) return photos;
  const supabase = await createClient();
  await Promise.all(
    paths.map(async (p) => {
      const { data } = await supabase.storage.from("employee-photos").download(p);
      const jpeg = data ? await toJpeg(Buffer.from(await data.arrayBuffer()), 240) : null;
      if (jpeg) photos.set(p, jpeg);
    }),
  );
  return photos;
}

export function PdfHeader({
  brand,
  title,
  subtitle,
}: {
  brand: Brand;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={s.header} fixed>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an <img> */}
      {brand.logo && <Image src={brand.logo} style={s.logo} />}
      <View style={{ flex: 1 }}>
        <Text style={s.studio}>{brand.name}</Text>
        {brand.contact ? <Text style={s.small}>{brand.contact}</Text> : null}
      </View>
      <View>
        <Text style={s.docTitle}>{title}</Text>
        {subtitle ? <Text style={[s.small, { textAlign: "right" }]}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function PdfFooter({ note }: { note: string }) {
  return (
    <>
      <Text style={s.footerNote} fixed>
        {note}
      </Text>
      <Text
        style={s.footerPage}
        fixed
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </>
  );
}

/** Renders a <Document> to PDF bytes (e.g. to attach to an email). */
export async function renderPdf(
  /** A component that renders a <Document>. */
  doc: React.ReactElement,
): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(doc as React.ReactElement<DocumentProps>);
}

/** Renders a <Document> to a PDF response (inline, with a file name for saving). */
export async function pdfResponse(
  /** A component that renders a <Document>. */
  doc: React.ReactElement,
  fileName: string,
): Promise<Response> {
  const buffer = await renderPdf(doc);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName.replace(/[^\w.-]+/g, "-")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
