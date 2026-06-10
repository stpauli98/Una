# Test komande — sve npm scripts

Brzi reference.

## Setup

```bash
npm run test:setup
```

Pokreće Docker Supabase, generiše `.env.test`, kreira admin user. **Pokreni jednom prije bilo kog testa.**

## Unit testovi

```bash
npm test                    # Single run (304 testa, ~5s)
npm run test:watch          # Watch mode (re-run na file change)
```

Filteri:

```bash
npm test -- availability    # Samo availability.test.ts
npm test -- -t "ceka"        # Samo testovi sa "ceka" u nazivu
```

## E2E testovi

```bash
npm run test:e2e            # Sve e2e (15+ specova, ~3 min)
npm run test:e2e:local      # Sa .env.test (preporučeno za lokal)
```

Filteri:

```bash
npx playwright test booking          # Samo booking.spec.ts
npx playwright test --headed         # Sa browser UI
npx playwright test --debug          # Pause execution
```

## Build verifikacija

```bash
npm run build               # Production build
npm run lint                # ESLint
npm run typecheck           # tsc --noEmit
```

Pokreni prije commit-a.

## Supabase upravljanje

```bash
npm run supabase:start      # Start Docker
npm run supabase:stop       # Stop
```

Equivalent direktno:

```bash
supabase start
supabase stop
```

## Combined

```bash
npm run test:all            # Unit + E2E
```

## Dev server

```bash
npm run dev                 # http://localhost:3000
```

Hot reload, lazy compile, Turbopack.

## Production preview

```bash
npm run build && npm start  # http://localhost:3000 sa production build-om
```

Korisno za testiranje production performansi lokalno.

## Generate types iz DB

```bash
npm run gen:types           # (TBD — možda treba dodati u package.json)
```

Equivalent:

```bash
supabase gen types typescript --linked > src/types/database.ts
```

Pokreni nakon migracija.

## CI scripts (TBD)

GitHub Actions ne podržava trenutno, ali workflow bi:

```yaml
- run: npm install
- run: npm run lint
- run: npm run typecheck
- run: npm test
- run: npm run test:e2e
```

## Cleanup

```bash
# Reset Docker baze
supabase db reset

# Stop + clean Docker volume
supabase stop --backup=false
```

## Help

```bash
npx playwright --help        # Playwright opcije
npx vitest --help            # Vitest opcije
supabase --help              # Supabase CLI
```

## Time-sensitive testovi

Neki testovi koriste `Date.now()` ili relativne datume. Ako CI pokrene u različitom timezone-u, mogu padati.

Mitigacija: koristiti `sarajevoDate()` helper iz `tests/e2e/helpers.ts` koji forsira Sarajevo TZ.

## Watch mode workflow

Tipičan dev workflow:

```bash
# Terminal 1: watch testove
npm run test:watch

# Terminal 2: dev server
npm run dev

# Pišeš kod → testovi se auto-re-run
```

## Sledeće

- [unit-tests.md](./unit-tests.md) — Vitest detalje
- [e2e-tests.md](./e2e-tests.md) — Playwright detalje
