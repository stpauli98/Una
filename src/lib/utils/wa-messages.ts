import { formatDate, formatTime } from "./format";

export type AppointmentStatus = "ceka" | "potvrdjen" | "otkazan" | "zavrsen";

export type WaMessageInput = {
  clientName: string;
  serviceName: string;
  startTime: Date;
  status: AppointmentStatus;
};

/**
 * Generiše WhatsApp poruku za dati termin prilagođenu statusu:
 * - otkazan → izvinjenje i poziv za novi termin
 * - zavrsen → zahvalnica
 * - ceka / potvrdjen → potvrda termina
 */
export function buildAppointmentWaMessage(input: WaMessageInput): string {
  const { clientName, serviceName, startTime, status } = input;
  const firstName = clientName.split(" ")[0];
  const dateTimeLabel = `${formatDate(startTime)} u ${formatTime(startTime)}`;

  switch (status) {
    case "otkazan":
      return `Zdravo ${firstName}, Una iz UP Makeup ovdje. Nažalost moram otkazati vaš termin za ${serviceName} (${dateTimeLabel}). Izvinjavam se na neprijatnosti 🙏 Slobodno se javite da dogovorimo novi termin.`;
    case "zavrsen":
      return `Zdravo ${firstName}, hvala vam što ste me posjetili! Nadam se da ste zadovoljni tretmanom. Vidimo se uskoro 💕 — Una`;
    case "ceka":
    case "potvrdjen":
    default:
      return `Zdravo ${firstName}, Una iz UP Makeup ovdje. Potvrđujem vaš termin za ${serviceName} u ${dateTimeLabel}. Vidimo se! 💕`;
  }
}

/** Kratka oznaka dugmeta zavisno od statusa — prikazuje se kraj ikone u admin tabeli. */
export function waButtonLabel(status: AppointmentStatus): string {
  switch (status) {
    case "otkazan":
      return "WhatsApp otkaz";
    case "zavrsen":
      return "WhatsApp hvala";
    default:
      return "WhatsApp potvrda";
  }
}
