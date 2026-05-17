// Generate a 512x512 maskable PWA icon for Android adaptive launchers.
//
// Maskable spec: the logo must fit inside an 80% safe zone (centered);
// the outer 10% on each side may be cropped by the OS into circle/squircle/
// teardrop/rounded-square shapes. Strategy: full-bleed brand gradient
// background + centered "UP" text well inside the safe zone.
//
// SOURCE: keep brand colors in sync with src/lib/constants/theme.ts
// (BRAND_COLORS). We inline hex values here because .mjs cannot import .ts
// without an extra transpile step (tsx/ts-node not in deps).

import sharp from "sharp";
import { mkdir } from "node:fs/promises";

// Mirror of BRAND_COLORS in src/lib/constants/theme.ts — update both together.
const BRAND_COLORS = {
  theme: "#3d2b2b",
  themeLight: "#5a3838",
  foreground: "#faf7f2",
};

const OUT = "public/icons/maskable-512.png";
const SIZE = 512;

await mkdir("public/icons", { recursive: true });

const svg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND_COLORS.theme}"/>
      <stop offset="100%" stop-color="${BRAND_COLORS.themeLight}"/>
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
    fill="${BRAND_COLORS.foreground}"
  >UP</text>
</svg>
`);

await sharp(svg).png({ compressionLevel: 9 }).toFile(OUT);
console.log(`✓ wrote ${OUT}`);
