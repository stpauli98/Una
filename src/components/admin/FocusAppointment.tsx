"use client";

import { useEffect } from "react";

type Props = {
  /** Appointment ID prosljeđen iz `?focus=<id>` URL parametra. */
  focusId: number | null;
};

const HIGHLIGHT_CLASSES = ["ring-2", "ring-rose", "ring-offset-2"];
const HIGHLIGHT_DURATION_MS = 3000;
const FOCUS_DELAY_MS = 400;

/**
 * Side-effect komponent koji skroluje na konkretan AppointmentRow (id="appt-N"),
 * podiže ring highlight 3s i premjesti tastaturni fokus na "Potvrdi" dugme.
 * Render-uje `null` — ne dodaje DOM.
 *
 * Mountuje se sa `focus` query parametrom (npr. iz dashboard-a kad user klikne
 * termin). Bez param-a → no-op.
 *
 * Highlight koristi Tailwind ring utility-je (umjesto bg color) tako da se ne
 * sukobljava sa AppointmentRow "isPast" opacity dimming-om.
 */
export function FocusAppointment({ focusId }: Props) {
  useEffect(() => {
    if (focusId == null) return;

    const el = document.getElementById(`appt-${focusId}`);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add(...HIGHLIGHT_CLASSES);

    // Fokusiraj Potvrdi dugme tek nakon scroll-a — tastaturni Enter onda
    // potvrđuje termin bez još jednog klika. Ako termin nije u "ceka"
    // statusu, button selector neće ništa naći i fokus se ne mijenja.
    const focusTimer = setTimeout(() => {
      const btn = el.querySelector<HTMLButtonElement>(
        'button[data-action="confirm"]',
      );
      btn?.focus();
    }, FOCUS_DELAY_MS);

    const removeTimer = setTimeout(() => {
      el.classList.remove(...HIGHLIGHT_CLASSES);
    }, HIGHLIGHT_DURATION_MS);

    return () => {
      clearTimeout(focusTimer);
      clearTimeout(removeTimer);
      el.classList.remove(...HIGHLIGHT_CLASSES);
    };
  }, [focusId]);

  return null;
}
