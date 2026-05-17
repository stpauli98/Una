/**
 * Brand color tokens — single source of truth for use in metadata routes
 * (manifest, icons, OG image, viewport). For Tailwind utility classes,
 * see `@theme` directive in src/app/globals.css — those values must stay
 * in sync with these.
 */
export const BRAND_COLORS = {
  /** Deep brown — primary brand color, theme_color in manifest, html theme-color meta */
  theme: "#3d2b2b",
  /** Light marble — page background_color in manifest, default body bg */
  background: "#faf7f2",
  /** Slightly lighter brown — used in icon gradient stops */
  themeLight: "#5a3838",
  /** Cream foreground — text on dark brand backgrounds */
  foreground: "#faf7f2",
} as const;
