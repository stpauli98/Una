/**
 * Vraća `target` samo ako je relativan path na istom origin-u.
 * Inače vraća `fallback`. Sprječava open-redirect phishing kroz
 * ?redirect= query parametar nakon login-a.
 */
export function safeRedirect(
  target: string | null | undefined,
  fallback: string,
): string {
  if (typeof target !== "string" || target.length === 0) return fallback;
  if (!target.startsWith("/")) return fallback;
  // Odbij protocol-relative ("//evil.com") i backslash varijantu ("/\evil.com")
  if (target.startsWith("//") || target.startsWith("/\\")) return fallback;
  // Odbij control chars (CR/LF/NUL) — sprječavaju malformed router.push() navigaciju
  if (/[\r\n\0]/.test(target)) return fallback;
  // Odbij scheme prefixe (javascript:, data:, http:, ...).
  // Scheme može biti samo prije prvog "/" u path-u (RFC 3986); zato gledamo
  // samo segment do prve kose crte.
  const afterSlash = target.slice(1);
  const slashIdx = afterSlash.indexOf("/");
  const head = slashIdx === -1 ? afterSlash : afterSlash.slice(0, slashIdx);
  const colonIdx = head.indexOf(":");
  if (colonIdx !== -1) {
    const possibleScheme = head.slice(0, colonIdx);
    if (/^[a-z][a-z0-9+.-]*$/i.test(possibleScheme)) return fallback;
  }
  return target;
}
