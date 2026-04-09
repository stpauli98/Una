import { z } from "zod";
import { isValidPhone } from "@/lib/utils/phone";

/**
 * Zod shema za booking formu (Step 3).
 * Validacija je usklađena sa bazom: `client_phone` se normalizuje
 * prije upisa u `appointments` (vidi `src/app/zakazi/actions.ts`).
 */
export const bookingFormSchema = z.object({
  service_id: z.number().int().positive(),
  start_time: z.string().datetime({
    message: "Neispravan format vremena",
  }),
  client_name: z
    .string()
    .min(2, "Unesite ime i prezime")
    .max(100, "Maksimalno 100 karaktera"),
  client_phone: z
    .string()
    .refine(
      isValidPhone,
      "Neispravan broj telefona. Primjer: 065 123 456 ili +49 151 23456789",
    ),
  client_email: z
    .string()
    .email("Neispravna email adresa")
    .optional()
    .or(z.literal("")),
  notes: z.string().max(500, "Maksimalno 500 karaktera").optional(),
  consent: z.literal(true, {
    message: "Saglasnost je obavezna",
  }),
});

export type BookingFormInput = z.infer<typeof bookingFormSchema>;

/**
 * Zod shema za upit o obuci (`/obuka` stranica).
 */
export const trainingInquirySchema = z.object({
  name: z.string().min(2, "Unesite ime i prezime").max(100),
  phone: z
    .string()
    .refine(
      isValidPhone,
      "Neispravan broj telefona. Primjer: 065 123 456 ili +49 151 23456789",
    ),
  email: z
    .string()
    .email("Neispravna email adresa")
    .optional()
    .or(z.literal("")),
  message: z.string().max(1000, "Maksimalno 1000 karaktera").optional(),
});

export type TrainingInquiryInput = z.infer<typeof trainingInquirySchema>;
