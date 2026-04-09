import type { FullConfig } from "@playwright/test";

/**
 * Pokreće se jednom prije svih e2e testova. Čisti bilo kakve orphan test
 * podatke iz prethodnih run-ova (seedovani termini, time blocks) koji bi
 * mogli da interferuju sa novim testovima.
 */
export default async function globalSetup(_config: FullConfig) {
  const url = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.warn(
      "[global-setup] E2E_SUPABASE_SERVICE_ROLE_KEY nije postavljen — skipping cleanup",
    );
    return;
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };

  // Briši sve test appointments
  await fetch(
    `${url}/rest/v1/appointments?client_name=like.Test%20Klijent*`,
    { method: "DELETE", headers },
  );
  await fetch(`${url}/rest/v1/appointments?client_name=like.E2E*`, {
    method: "DELETE",
    headers,
  });

  // Briši sve test time blocks
  await fetch(`${url}/rest/v1/time_blocks?reason=like.E2E*`, {
    method: "DELETE",
    headers,
  });
}
