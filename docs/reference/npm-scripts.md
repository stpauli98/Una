# Reference: Sve npm scripts

Iz `package.json`.

## Razvoj

| Skripta | Komanda | Šta radi |
|---------|---------|----------|
| `dev` | `next dev` | Hot-reload dev server na 3000 (Turbopack) |
| `build` | `next build --webpack` | Production build (webpack — Serwist SW bundling ne radi pod Turbopack-om) |
| `start` | `next start -H 0.0.0.0` | Pokreće production build, bind na sve interfejse (test sa telefona u LAN-u) |

## Quality

| Skripta | Komanda | Šta radi |
|---------|---------|----------|
| `lint` | `eslint` | ESLint direktno (Next 16 je uklonio `next lint`) |
| `typecheck` | `tsc --noEmit` | TypeScript type check |

## Testiranje

| Skripta | Komanda | Šta radi |
|---------|---------|----------|
| `test` | `vitest run` | Single run unit testova (390 testova) |
| `test:watch` | `vitest` | Watch mode |
| `test:e2e` | `playwright test` | E2E sa trenutnim `.env.local` |
| `test:e2e:local` | swap skripta (vidi ispod) | E2E sa lokalnim Docker env |
| `test:e2e:pwa` | `scripts/run-pwa-e2e.sh` | Production build + PWA/SEO e2e suite |
| `test:setup` | `bash scripts/setup-test-env.sh` | Pokreni Docker Supabase + gen .env.test |
| `test:all` | `npm test && npm run test:e2e:local` | Unit + E2E |

### Kako `test:e2e:local` radi

```bash
mv .env.local .env.local.prod   # skloni produkcijski env
cp .env.test .env.local          # ubaci test env
npx playwright test              # e2e protiv lokalnog Docker Supabase
mv .env.local.prod .env.local    # OBAVEZNO vrati (i na failure — exit code se čuva)
```

Swap je neophodan jer Next.js učitava `.env.local` automatski — `DOTENV_CONFIG_PATH` ne bi pokrio Next dev server. Originalni `.env.local` (produkcija!) se garantovano vraća.

## Supabase

| Skripta | Komanda | Šta radi |
|---------|---------|----------|
| `supabase:start` | `supabase start` | Start Docker containers |
| `supabase:stop` | `supabase stop` | Stop |

## Tipičan workflow

### Prvi setup

```bash
git clone <repo>
cd up-beauty
npm install
cp .env.example .env.local
# Edit .env.local sa pravim Supabase keys
npm run test:setup   # Pokrene Docker
```

### Dnevni dev

```bash
npm run dev          # Terminal 1
npm run test:watch   # Terminal 2
```

### Pre commit-a

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Ako sve prolazi → safe za commit.

### Pre PR-a

```bash
npm run test:all     # Unit + E2E
```

E2E je sporo (~3 min), pa se ne pokreće na svaki commit.
