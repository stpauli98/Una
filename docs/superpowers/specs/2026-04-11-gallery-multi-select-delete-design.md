# Gallery Multi-Select Delete — Design

**Date:** 2026-04-11
**Status:** Approved

## Problem

Una može brisati slike iz galerije samo jednu po jednu — klik na X, confirm, čeka, pa sljedeća. Ako ima 20 slika za brisanje, to je 20 potvrda i 20 server poziva.

## Rješenje

Dodati selection mode u `GalleryManager.tsx` sa batch delete server action-om.

## Dva moda

### Normalni mode (default)
- Galerija izgleda identično kao sada
- Svaka slika ima X na hover za pojedinačno brisanje
- Dugme "Izaberi" u toolbar-u za prelazak u selection mode

### Selection mode
- Aktivira se klikom na "Izaberi" dugme
- Svaka slika dobija checkbox (gornji lijevi ugao)
- Klik na sliku togglea selekciju
- Selektovane slike: rose border + blagi tinted overlay
- Toolbar prikazuje:
  - "N izabrano" tekst
  - "Izaberi sve" link (selektuje sve u aktivnoj kategoriji)
  - "Obriši izabrane" dugme (crveno, disabled ako ništa nije selektovano)
  - "Otkaži" dugme (vraća u normalni mode, čisti selekciju)
- Promjena kategorija taba → resetuje selekciju i vraća normalni mode

## Server action

Novi `deleteGalleryImages(ids: number[])` u `galerija/actions.ts`:
- Prima array ID-jeva
- Za svaki: briše storage objekt + DB red (isti flow kao postojeći `deleteGalleryImage` ali u petlji)
- Jedan server poziv umjesto N
- `revalidatePath` na kraju (jednom, ne N puta)
- Vraća `{ ok: true, deleted: number }` ili `{ ok: false, error: string }`

## State management u komponenti

```ts
const [selectMode, setSelectMode] = useState(false);
const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
```

- `selectMode` kontroliše koji UI se prikazuje
- `selectedIds` je Set za O(1) toggle/check
- Kad se `activeCategory` promijeni → `setSelectMode(false)` + `setSelectedIds(new Set())`

## Kritični fajlovi

| Fajl | Akcija |
|---|---|
| `src/components/admin/GalleryManager.tsx` | MODIFY — dodaj selectMode, selectedIds, toolbar, checkbox overlay |
| `src/app/admin/(protected)/galerija/actions.ts` | MODIFY — dodaj `deleteGalleryImages(ids[])` batch action |

## Što se NE mijenja
- Upload zona — ista
- Kategorija tabovi — isti (osim reset selekcije pri promjeni)
- Pojedinačno brisanje — ostaje u normalnom modu
- Server action `uploadGalleryImages` — isti
- Public galerija — ista
