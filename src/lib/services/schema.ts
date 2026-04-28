import { z } from "zod";

/**
 * Dozvoljene vrijednosti za `duration_min` u admin formi za usluge.
 * Sve su multipli od `SLOT_INTERVAL_MIN` (30) iz availability engine-a,
 * tako da nikad ne pravimo rupe u kalendaru.
 *
 * Min: 30 (mora biti ≥ grid step).
 * Max: 240 (cijela dužina weekday radnog vremena 17:00–21:00).
 */
export const ALLOWED_DURATIONS = [
  30, 60, 90, 120, 150, 180, 210, 240,
] as const;

export type AllowedDuration = (typeof ALLOWED_DURATIONS)[number];

/**
 * Zod shema za admin Service formu (Nova / Izmijeni uslugu).
 * Šalje se preko `parseFormData` u `src/app/admin/(protected)/usluge/actions.ts`.
 */
export const serviceSchema = z
  .object({
    name: z.string().min(2).max(100),
    description: z.string().max(500).optional().nullable(),
    price: z.number().nonnegative().nullable(),
    price_note: z.string().max(100).optional().nullable(),
    duration_min: z
      .number()
      .int()
      .nullable()
      .refine(
        (v) =>
          v === null || (ALLOWED_DURATIONS as readonly number[]).includes(v),
        `Trajanje mora biti jedna od dozvoljenih vrijednosti (${ALLOWED_DURATIONS.join(", ")} min) ili prazno`,
      ),
    duration_note: z.string().max(100).optional().nullable(),
    category: z.enum(["sminkanje", "pedikir", "trepavice", "obuka"]),
    bookable: z.boolean(),
    variable_price: z.boolean(),
    active: z.boolean(),
  })
  // Mora biti popunjeno bar jedno: fiksni broj ili tekstualna napomena.
  // Bez ovog refine-a, Una bi mogla sačuvati uslugu bez ikakve cijene.
  .refine(
    (data) =>
      data.price !== null ||
      (data.price_note !== null &&
        data.price_note !== undefined &&
        data.price_note.length > 0),
    {
      message: "Mora biti popunjena ili cijena (broj) ili napomena cijene (tekst)",
      path: ["price"],
    },
  );

export type ServiceInput = z.infer<typeof serviceSchema>;
