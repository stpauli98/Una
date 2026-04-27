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
  // Odbij sve sa schemeom (javascript:, data:, http:, ...)
  if (/^[a-z][a-z0-9+.-]*:/i.test(target.slice(1))) return fallback;
  return target;
}
