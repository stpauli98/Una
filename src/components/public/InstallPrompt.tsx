"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "up-beauty-install-dismissed";

export function InstallPrompt() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Ne montiraj prompt na admin rutama — Una koristi iOS Share, ne Chrome prompt.
    if (isAdmin) return;
    // Test marker — Playwright potvrđuje da je effect izvršen na non-admin rutama.
    document.body.dataset.installPromptMounted = "true";
    // Already installed (standalone display mode)?
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // User dismissed in the last 30 days?
    const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) ?? 0);
    if (Date.now() - dismissedAt < 30 * 24 * 60 * 60 * 1000) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      // Show after 5s so it doesn't fight the cookie banner
      setTimeout(() => setVisible(true), 5000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      delete document.body.dataset.installPromptMounted;
    };
  }, [isAdmin]);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setVisible(false);
    setDeferred(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  if (isAdmin || !visible || !deferred) return null;

  return (
    <div
      role="dialog"
      aria-label="Instaliraj aplikaciju"
      className="fixed inset-x-3 bottom-safe-3 z-[55] mx-auto flex max-w-[420px] items-center gap-3 border border-cream bg-white/98 p-3 shadow-lg backdrop-blur-md md:bottom-5"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded bg-rose/10 text-rose">
        <Download size={18} strokeWidth={1.5} />
      </div>
      <div className="flex-1 text-[12px] leading-snug text-dark">
        Instaliraj UP Beauty na početni ekran za brži pristup.
      </div>
      <button
        type="button"
        onClick={handleInstall}
        className="shrink-0 bg-rose px-3 py-2 text-[10px] uppercase tracking-wider text-white hover:bg-rose-hover"
      >
        Instaliraj
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Odbaci"
        className="flex size-8 shrink-0 items-center justify-center text-light hover:text-dark"
      >
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}
