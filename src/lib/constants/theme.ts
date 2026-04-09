/**
 * Brand design tokens. Mirrors the CSS custom properties defined in
 * `src/app/globals.css` via Tailwind's `@theme` directive. Use the
 * Tailwind classes for styling; these constants exist for the rare
 * places where inline style values are unavoidable (e.g. SVG fills,
 * email templates, dynamic gradients).
 */
export const colors = {
  rose: "#C4787A",
  roseHover: "#A8616A",
  pink: "#D4A0A0",
  blush: "#E8C4C4",
  cream: "#F0E6DD",
  warm: "#F8F3EF",
  marble: "#FDFBF9",
  gold: "#B8965A",
  goldLight: "#D4B47A",
  dark: "#3D2B2B",
  body: "#6B5555",
  light: "#9B8585",
} as const;

export type ColorToken = keyof typeof colors;
