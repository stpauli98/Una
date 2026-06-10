# `/o-meni` — O meni

**Fajl:** `src/app/o-meni/page.tsx`

Predstavljanje Une — ko je, njena priča, iskustvo.

## Layout

2-column desktop, 1-column mobile (`grid gap-12 md:grid-cols-[320px_1fr]`):

- Lijevo (`320px` na desktop, gore na mobilnom): Slika Une (`w-[75%] max-w-[280px]` na mobile)
- Desno: Heading + tekst + CTA dugmad

## CTA dugmad

`flex flex-wrap gap-3` — wrap-uju ako ne stanu side-by-side:

- "Zakaži termin" (rose)
- "Pogledaj galeriju" (outline)

Touch target `px-8 py-3.5` (≥44px).

## SEO

| Element | Vrijednost |
|---------|-----------|
| Title | "O meni — Una Peranović" |
| Description | "Una Peranović — profesionalna make-up artistkinja iz Gradiške..." |
| Breadcrumb | Početna > O meni |

## Statična generacija

Bez `revalidate` ili `force-dynamic` — Next.js pre-renderuje na build time. Ako se sadržaj mijenja, treba novi deploy.
