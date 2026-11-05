#!/usr/bin/env node
/**
 * Cuts the header logo pieces out of public/brand/logo.jpg (the stacked logo on
 * white): the camera mark and the "Light Chasers / STUDIO" wordmark, each with a
 * transparent background, plus dark-mode copies where the grey ink turns ivory
 * and the brand colours stay. Run again after replacing logo.jpg:
 *
 *   node scripts/brand-assets.mjs
 *
 * Writes public/brand/{mark,wordmark}{,-dark}.png.
 */
import sharp from "sharp";

const SRC = "public/brand/logo.jpg";
const OUT = "public/brand/";
const IVORY = [237, 232, 223];

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const original = Buffer.from(data); // the colours as they look on white

// Colour-to-alpha against white: each pixel becomes the colour that, laid over
// white, gives the original, so edges stay smooth on any background.
for (let i = 0; i < data.length; i += 4) {
  const a = Math.max(255 - data[i], 255 - data[i + 1], 255 - data[i + 2]) / 255;
  if (a < 0.04) {
    data[i + 3] = 0;
    continue;
  }
  for (let k = 0; k < 3; k++) data[i + k] = Math.round(255 - (255 - data[i + k]) / a);
  data[i + 3] = Math.round(a * 255);
}

const inked = (x, y) => data[(y * W + x) * 4 + 3] > 40;

// Rows with ink form two bands: the mark on top, the words below.
const bands = [];
let start = -1;
for (let y = 0; y <= H; y++) {
  let ink = false;
  for (let x = 0; y < H && x < W && !ink; x++) ink = inked(x, y);
  if (ink && start < 0) start = y;
  if (!ink && start >= 0) {
    if (y - start > 20) bands.push([start, y]);
    start = -1;
  }
}
if (bands.length < 2)
  throw new Error(`Expected a mark above the words, found ${bands.length} band(s).`);

function box(y0, y1) {
  let left = W,
    right = 0,
    top = H,
    bottom = 0;
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < W; x++)
      if (inked(x, y)) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/**
 * For dark backgrounds: grey (unsaturated) ink becomes ivory, the sage and
 * terracotta keep the light shade they have on white (the unmixed colours are too
 * dark there), and thin strokes get a little more opacity so "STUDIO" still reads.
 */
function darkCopy(buf) {
  const out = Buffer.from(buf);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) continue;
    const [r, g, b] = [original[i], original[i + 1], original[i + 2]];
    const grey = Math.max(r, g, b) - Math.min(r, g, b) < 28;
    [out[i], out[i + 1], out[i + 2]] = grey ? IVORY : [r, g, b];
    out[i + 3] = Math.min(255, Math.round(out[i + 3] * 1.35));
  }
  return out;
}

const pieces = [
  { name: "mark", box: box(...bands[0]), height: 192 },
  { name: "wordmark", box: box(bands[1][0], bands.at(-1)[1]), height: 160 },
];
for (const [suffix, pixels] of [
  ["", data],
  ["-dark", darkCopy(data)],
]) {
  for (const p of pieces) {
    await sharp(pixels, { raw: { width: W, height: H, channels: 4 } })
      .extract(p.box)
      .resize({ height: p.height })
      .png({ compressionLevel: 9 })
      .toFile(`${OUT}${p.name}${suffix}.png`);
  }
}
console.log("Wrote", pieces.map((p) => `${p.name}(-dark).png`).join(", "));
