/**
 * CSV helper-i optimizovani za Excel/LibreOffice u EU lokalu.
 *
 * Konvencija:
 *   - Separator: semicolon (`;`) — Excel u BiH/HR/SR default-u koristi
 *     semicolon, ne comma. Sa comma separator-om svaki red bi se učitao
 *     u jednu kolonu.
 *   - Encoding: UTF-8 sa BOM (vidi `CSV_BOM` konstantu) — bez BOM-a Excel
 *     često pokvari naša slova (č, ć, š, đ, ž).
 *   - Wrapping: ako field sadrži separator, navodnik, ili newline, omotaj
 *     u `"..."`. Navodnici unutar field-a se dupliraju (`""` umjesto `"`).
 *     RFC 4180-compatible.
 */

/** UTF-8 BOM prefix — uvijek ga dodati ispred CSV body-ja. */
export const CSV_BOM = "﻿";

/** Separator koji Excel u EU lokalu očekuje. */
export const CSV_SEPARATOR = ";";

export type CsvCell = string | number | null | undefined;

/**
 * Escape-uje jednu CSV ćeliju. Null/undefined → prazan string.
 * Brojevi se konvertuju u string. Specijalni karakteri triger-uju wrap.
 */
export function csvEscape(value: CsvCell): string {
  if (value == null) return "";
  const s = String(value);
  if (s === "") return "";
  if (/^[=+\-@\t\r]/.test(s)) {
    return `"'${s.replace(/"/g, '""')}"`;
  }
  if (/[";\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Spaja ćelije u jedan CSV red — escape-uje svaku i lijepi separator-om. */
export function buildCsvRow(cells: ReadonlyArray<CsvCell>): string {
  return cells.map(csvEscape).join(CSV_SEPARATOR);
}
