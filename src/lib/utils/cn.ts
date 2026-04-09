import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Spaja Tailwind klase, razrešava konflikte (npr. `p-2 p-4` → `p-4`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
