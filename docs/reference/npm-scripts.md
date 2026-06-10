# Reference: Sve npm scripts

Iz `package.json`.

## Razvoj

| Skripta | Komanda | Šta radi |
|---------|---------|----------|
| `dev` | `next dev` | Hot-reload dev server na 3000 |
| `build` | `next build` | Production build |
| `start` | `next start` | Pokreće production build (lokalno test) |

## Quality

| Skripta | Komanda | Šta radi |
|---------|---------|----------|
| `lint` | `next lint` | ESLint |
| `typecheck` | `tsc --noEmit` | TypeScript type check |

## Testiranje

| Skripta | Komanda | Šta radi |
|---------|---------|----------|
| `test` | `vitest run` | Single run unit testova |
| `test:watch` | `vitest` | Watch mode |
| `test:e2e` | `playwright test` | E2E sa default env |
| `test:e2e:local` | `DOTENV_CONFIG_PATH=.env.test playwright test` | E2E sa lokalnim env |
| `test:setup` | `bash scripts/setup-test-env.sh` | Pokreni Docker Supabase + gen .env.test |
| `test:all` | `npm test && npm run test:e2e:local` | Unit + E2E |

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
