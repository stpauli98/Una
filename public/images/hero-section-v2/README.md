# Hero Section V2 Images

Folder za **5 webp slika** koje koristi varijanta A v2 hero (bento gallery scroll-driven).

**Konvencija imenovanja:** bilo koje WebP fajlove (UUID, opisni nazivi, itd.). Bitno je da:
- Tačno 5 fajlova
- Svaki `.webp` format
- Optimalna dimenzija ~1080×1920 (portrait) ili 1920×1080 (landscape)
- Veličina po slici 100-300 KB (pre-optimized)

**Kako dodaj slike:**
1. Kopiraj 5 webp fajlova u ovaj folder
2. Javi i ja ću ažurirati `src/lib/images/hero-images.ts` da pokazuje na njih
3. Build + E2E test
4. Push + PR

**Razlika od V1** (`/public/images/hero-section/`):
- V1 koristi 7 trenutnih slika studio interijera
- V2 koristi tvoje nove slike (npr. drugačija paleta, fokus, ili content)
