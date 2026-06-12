// scripts/health/lib/email.mjs
import { execFileSync } from "node:child_process";
import { formatInTimeZone } from "date-fns-tz";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildEmailSubject(results, now) {
  const fail = results.filter((r) => r.status === "FAIL").length;
  const warn = results.filter((r) => r.status === "WARN").length;
  return `[UP Health] ${fail} FAIL, ${warn} WARN — ${formatInTimeZone(now, "Europe/Sarajevo", "dd.MM.yyyy HH:mm")}`;
}

export function buildEmailHtml(results) {
  const bad = results.filter((r) => r.status !== "PASS");
  const rows = bad.map((r) => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #ddd;color:${r.status === "FAIL" ? "#c0392b" : "#b07d12"};font-weight:bold">${r.status}</td>
      <td style="padding:6px 10px;border:1px solid #ddd">${esc(r.layer)}</td>
      <td style="padding:6px 10px;border:1px solid #ddd"><code>${esc(r.id)}</code></td>
      <td style="padding:6px 10px;border:1px solid #ddd">${esc(r.detail)}${r.expected ? `<br><small>očekivano: <code>${esc(r.expected)}</code><br>nađeno: <code>${esc(r.actual ?? "")}</code></small>` : ""}</td>
    </tr>`).join("");
  return `<h2>UP Beauty Health — odstupanja</h2>
<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
<tr><th style="padding:6px 10px;border:1px solid #ddd">Status</th><th style="padding:6px 10px;border:1px solid #ddd">Sloj</th><th style="padding:6px 10px;border:1px solid #ddd">Provjera</th><th style="padding:6px 10px;border:1px solid #ddd">Detalj</th></tr>
${rows}
</table>
<p style="font-family:sans-serif;font-size:13px;color:#666">Ručni rerun: <code>cd up-beauty &amp;&amp; npm run health</code></p>`;
}

/** Šalje email ako je RESEND_API_KEY dostupan; inače macOS notifikacija. */
export async function sendAlert(env, results, now = new Date()) {
  const subject = buildEmailSubject(results, now);
  if (env.RESEND_API_KEY && env.HEALTH_ALERT_EMAIL) {
    const { Resend } = await import("resend");
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL ?? "rezervacije@upmakeup.ba",
      to: env.HEALTH_ALERT_EMAIL,
      subject,
      html: buildEmailHtml(results),
    });
    if (!error) return { sent: "email" };
    console.error("Resend greška:", error.message ?? error);
  }
  try {
    execFileSync("osascript", ["-e", `display notification ${JSON.stringify(subject)} with title "UP Health"`]);
    return { sent: "notification" };
  } catch {
    return { sent: "none" };
  }
}
