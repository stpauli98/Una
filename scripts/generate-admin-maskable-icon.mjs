// Generate a 512x512 maskable PWA icon for the admin install.
// Same Android safe-zone (80%) approach as scripts/generate-maskable-icon.mjs,
// but with "AD" letters instead of "UP".
//
// SOURCE: keep brand colors in sync with src/lib/constants/theme.ts BRAND_COLORS.
//   theme:      "#3d2b2b"  (BRAND_COLORS.theme)
//   themeLight: "#5a3838"  (BRAND_COLORS.themeLight)
//   foreground: "#faf7f2"  (BRAND_COLORS.foreground)

import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const OUT = "public/icons/admin-maskable-512.png";
const SIZE = 512;

await mkdir("public/icons", { recursive: true });

const svg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3d2b2b"/>
      <stop offset="100%" stop-color="#5a3838"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
  <text
    x="50%"
    y="50%"
    dominant-baseline="central"
    text-anchor="middle"
    font-family="Georgia, serif"
    font-size="180"
    font-weight="600"
    letter-spacing="6"
    fill="#faf7f2"
  >AD</text>
</svg>
`);

await sharp(svg).png({ compressionLevel: 9 }).toFile(OUT);
console.log(`✓ wrote ${OUT}`);
