import { ImageResponse } from "next/og";
import { BRAND_COLORS } from "@/lib/constants/theme";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: `linear-gradient(135deg, ${BRAND_COLORS.theme} 0%, ${BRAND_COLORS.themeLight} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "serif",
          color: BRAND_COLORS.foreground,
          fontSize: 96,
          fontWeight: 600,
          letterSpacing: "0.04em",
        }}
      >
        UP
      </div>
    ),
    { ...size },
  );
}
