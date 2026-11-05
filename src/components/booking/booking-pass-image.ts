"use client";

// Draws the "booking pass" PNG a client saves to their phone after booking.
// Canvas can't read CSS tokens reliably (oklch), so the brand colours are inlined
// here, like in the emails.

const IVORY = "#FAF8F4";
const EVERGREEN = "#455D5A";
const TERRACOTTA = "#CE7056";
const BLUSH = "#F8E6DF";
const INK = "#263332";
const MUTED = "#5E6B69";

export type PassDetails = {
  reference: string;
  studioName: string;
  title: string | null;
  when: string | null;
  location: string | null;
  lookupUrl: string;
};

const W = 1080;
const H = 1350;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Font families next/font registered on the page (hashed names), with fallbacks. */
function fonts() {
  const probe = (cls: string, fallback: string) => {
    const el = document.createElement("span");
    el.className = cls;
    el.style.display = "none";
    document.body.append(el);
    const family = getComputedStyle(el).fontFamily || fallback;
    el.remove();
    return family;
  };
  return {
    heading: probe("font-heading", "Georgia, serif"),
    body: probe("font-sans", "sans-serif"),
  };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1]!.replace(/\s*\S+$/, "")}…`;
  }
  return lines;
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
  ctx.restore();
}

export async function drawBookingPass(d: PassDetails): Promise<Blob> {
  await document.fonts?.ready;
  const f = fonts();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = IVORY;
  ctx.fillRect(0, 0, W, H);

  // The card.
  const x = 80;
  const y = 80;
  const cw = W - 160;
  const ch = H - 160;
  ctx.save();
  ctx.shadowColor = "rgba(38, 51, 50, 0.15)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(x, y, cw, ch, 56);
  ctx.fill();
  ctx.restore();

  // Header band.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, cw, 470, [56, 56, 0, 0]);
  ctx.clip();
  ctx.fillStyle = EVERGREEN;
  ctx.fillRect(x, y, cw, 470);
  ctx.restore();
  sparkle(ctx, x + cw - 90, y + 90, 34, TERRACOTTA);
  sparkle(ctx, x + cw - 150, y + 160, 16, BLUSH);

  const logo = await loadImage("/brand/logo.jpg");
  if (logo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + 130, y + 140, 70, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.clip();
    ctx.drawImage(logo, x + 60, y + 70, 140, 140);
    ctx.restore();
  }
  ctx.fillStyle = "#fff";
  ctx.font = `600 34px ${f.body}`;
  ctx.fillText(d.studioName, x + 230, y + 152);

  ctx.font = `700 28px ${f.body}`;
  ctx.globalAlpha = 0.85;
  ctx.fillText("BOOKING REFERENCE", x + 60, y + 300);
  ctx.globalAlpha = 1;
  ctx.font = `600 96px ${f.heading}`;
  ctx.fillText(d.reference, x + 60, y + 400, cw - 120);

  // Details.
  let cy = y + 580;
  const rows: [string, string | null][] = [
    ["Package", d.title],
    ["When", d.when],
    ["Where", d.location],
  ];
  for (const [label, value] of rows) {
    if (!value) continue;
    ctx.fillStyle = MUTED;
    ctx.font = `700 26px ${f.body}`;
    ctx.fillText(label.toUpperCase(), x + 60, cy);
    ctx.fillStyle = INK;
    ctx.font = `600 40px ${f.body}`;
    for (const line of wrap(ctx, value, cw - 120, 2)) {
      cy += 54;
      ctx.fillText(line, x + 60, cy);
    }
    cy += 70;
  }

  // Footer note.
  const fy = y + ch - 230;
  ctx.fillStyle = BLUSH;
  ctx.beginPath();
  ctx.roundRect(x + 40, fy, cw - 80, 190, 36);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = `700 30px ${f.body}`;
  ctx.fillText("Find your booking any time", x + 80, fy + 65);
  ctx.font = `400 28px ${f.body}`;
  ctx.fillText("with this reference and your email at", x + 80, fy + 110);
  ctx.font = `700 28px ${f.body}`;
  ctx.fillText(d.lookupUrl, x + 80, fy + 152, cw - 160);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
  );
}
