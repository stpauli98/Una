// Generate UP-branded multi-resolution favicon.ico (16/32/48px).
// Replaces the default Next.js / Vercel scaffold favicon that ships with
// `create-next-app` — every browser tab currently shows the black "N"
// Vercel-default icon, which is misaligned with UP Beauty branding.
//
// Approach: render the brand gradient + "UP" text via SVG at three target
// sizes, raster each through sharp to PNG buffer, pack PNGs into a single
// .ico via png-to-ico. Result has 16/32/48 size variants — modern browsers
// pick the best fit per display density.
//
// SOURCE: keep brand colors in sync with src/lib/constants/theme.ts BRAND_COLORS.
//   theme:      "#3d2b2b"  (BRAND_COLORS.theme)
//   themeLight: "#5a3838"  (BRAND_COLORS.themeLight)
//   foreground: "#faf7f2"  (BRAND_COLORS.foreground)

import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFile } from "node:fs/promises";

const OUT = "src/app/favicon.ico";
const SIZES = [16, 32, 48];

// Font-size relative to canvas; tuned per-size so "UP" stays legible at 16px.
const FONT_SIZE_RATIO = {
  16: 0.55, // 9px — tighter to fit "UP" in tiny tab favicons
  32: 0.55, // 18px
  48: 0.55, // 26px
};

function makeSvg(size) {
  const fontSize = Math.round(size * FONT_SIZE_RATIO[size]);
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3d2b2b"/>
      <stop offset="100%" stop-color="#5a3838"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <text
    x="50%"
    y="50%"
    dominant-baseline="central"
    text-anchor="middle"
    font-family="Georgia, serif"
    font-size="${fontSize}"
    font-weight="600"
    fill="#faf7f2"
  >UP</text>
</svg>
`);
}

const pngBuffers = await Promise.all(
  SIZES.map(async (size) => {
    return sharp(makeSvg(size)).png({ compressionLevel: 9 }).toBuffer();
  }),
);

const icoBuffer = await pngToIco(pngBuffers);
await writeFile(OUT, icoBuffer);

console.log(`✓ wrote ${OUT} with sizes ${SIZES.join("/")}px`);
