# Gallery Upload UX — Design

**Date:** 2026-04-10
**Status:** Approved

## Problem

Admin galerija upload koristi default `<input type="file">` browser widget koji:
- Prikazuje "Choose Files / No file chosen" na engleskom
- Ne uklapa se u UP Beauty brend estetiku
- Ne pokazuje preview izabranih slika prije upload-a
- Nema vizuelni progress tokom upload-a + sharp kompresije
- Ne podržava drag & drop

## Rješenje

Zamjena `<input type="file">` sa custom **drag & drop upload zonom** u `GalleryManager.tsx`. Bez promjene server action-a — samo UI.

## Stanja komponente

### Idle (nema izabranih fajlova)
- Isprekidana (dashed) kutija sa Upload ikonom
- Tekst: "Prevucite slike ovdje ili kliknite za odabir"
- Podnaslov: "JPG, PNG ili WebP · Automatska kompresija"
- Klik otvara skriveni `<input type="file">`
- Drag over: border postaje rose, pozadina se lagano oboji

### Preview (fajlovi izabrani, čeka se klik "Učitaj")
- Grid (4 kolone) sa thumbnail preview-ima (`URL.createObjectURL`)
- Ispod svakog thumbnaila: ime fajla (skraćeno) + veličina (KB/MB)
- "X" dugme na svakom thumbnailu za uklanjanje iz selekcije
- Ispod grid-a: dugme "Učitaj N slika" (rose, primarno) + "Otkaži" (ghost)
- Una vidi tačno šta upload-uje prije potvrde

### Uploading (slanje u toku)
- Thumbnailovi ostaju vidljivi ali zatamnjeni (overlay 50% opacity)
- Centralni spinner ili pulsing indikator na svakom thumbnailu
- Dugme "Učitaj" disabled, tekst "Šaljem... (N slika)"
- "Otkaži" dugme disabled

### Success / Error (nakon upload-a)
- Zeleni/crveni banner (već postoji u kodu, samo se naslijedi)
- Thumbnailovi se čiste, zona se vraća na idle
- File input se resetuje

## Drag & Drop ponašanje
- `onDragOver` / `onDragEnter`: border rose + blagi rozi bg
- `onDragLeave`: vraća se na dashed cream
- `onDrop`: čita `e.dataTransfer.files`, filtrira po MIME tipu, prelazi u preview state
- Klik na zonu: otvara hidden `<input>` file picker (isti efekat)

## Thumbnail logika
- `URL.createObjectURL(file)` za lokalni preview (bez upload-a)
- `URL.revokeObjectURL` u cleanup-u da ne curi memorija
- Veličina fajla formatirana: `< 1024` → "X KB", `>= 1024` → "X.X MB"
- Ime fajla: max 20 karaktera + "..." ako je duže

## Šta se NE mijenja
- Server action `uploadGalleryImages` — ista FormData, isti flow
- `deleteGalleryImage` — isto
- Kategorija tabovi — isti
- Prikaz postojećih slika u gridu — isti
- Sharp kompresija na serveru — ista

## Scope
Samo `src/components/admin/GalleryManager.tsx` — jedan fajl, jedna komponenta. Nema novih zavisnosti. Nema migracija. Nema novih server action-a.
