import { ImageResponse } from "next/og";

export const alt = "UP Beauty & Makeup Studio — Gradiška";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(155deg, #3D2B2B 0%, #5a3e3e 35%, #C4787A 80%, #D4A0A0 100%)",
          fontFamily: "serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "60px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "18px",
              marginBottom: "30px",
            }}
          >
            <div
              style={{
                width: "60px",
                height: "1px",
                background: "#D4B47A",
              }}
            />
            <div
              style={{
                fontSize: "22px",
                letterSpacing: "8px",
                textTransform: "uppercase",
                color: "#D4B47A",
                fontStyle: "italic",
              }}
            >
              Beauty Studio · Gradiška
            </div>
            <div
              style={{
                width: "60px",
                height: "1px",
                background: "#D4B47A",
              }}
            />
          </div>

          <div
            style={{
              fontSize: "120px",
              fontWeight: 300,
              color: "white",
              letterSpacing: "10px",
              lineHeight: 1,
              marginBottom: "16px",
            }}
          >
            UP
          </div>
          <div
            style={{
              fontSize: "38px",
              fontWeight: 300,
              color: "white",
              letterSpacing: "2px",
              marginBottom: "30px",
            }}
          >
            Beauty & Makeup Studio
          </div>

          <div
            style={{
              fontSize: "26px",
              fontStyle: "italic",
              color: "rgba(255,255,255,0.75)",
              letterSpacing: "1px",
            }}
          >
            Osmijeh je najljepša šminka
          </div>
        </div>
      </div>
    ),
    size,
  );
}
