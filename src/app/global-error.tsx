"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="sr-Latn">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fdfbf9", color: "#5a4545" }}>
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.3em", color: "#c4787a", marginBottom: "8px" }}>
              Kritična greška
            </p>
            <h1 style={{ fontSize: "2rem", fontWeight: 300, color: "#3d2b2b", marginBottom: "16px" }}>
              Nešto je pošlo po zlu
            </h1>
            <p style={{ fontSize: "14px", marginBottom: "32px" }}>
              Aplikacija je naišla na neočekivanu grešku.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ background: "#c4787a", color: "#fff", border: "none", padding: "14px 32px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.25em", cursor: "pointer" }}
            >
              Pokušaj ponovo
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
