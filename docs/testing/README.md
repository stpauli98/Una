# Testiranje — pregled

Kompletna test strategija — od unit-a do e2e.

## Statistika

| Tip | Broj | Framework |
|-----|------|-----------|
| Unit testovi | 304 | Vitest |
| E2E testovi | 14+ specova | Playwright |

## Kategorije

| Tema | Fajl | Šta pokriva |
|------|------|-------------|
| Docker setup | [docker-setup.md](./docker-setup.md) | Lokalna Supabase instance za testove |
| Unit testovi | [unit-tests.md](./unit-tests.md) | Vitest setup, struktura |
| E2E testovi | [e2e-tests.md](./e2e-tests.md) | Playwright setup, helperi |
| Test komande | [npm-scripts.md](./npm-scripts.md) | Sve test komande |

## Filozofija

| Sloj | Tip testova | Cilj |
|------|-------------|------|
| Pure functions | Unit (Vitest) | Fast, isolated, 100% pokrivenost |
| Server actions | Indirect (kroz e2e) | Behavioral, ne unit |
| UI komponente | E2E (Playwright) | Funkcionalnost u browseru |
| Auth + RLS | E2E | Realni HTTP requests |

## Quick start

```bash
# 1. Pokreni lokalni Docker Supabase
npm run test:setup

# 2. Unit testovi
npm test                  # 304 testa, ~5s

# 3. E2E testovi
npm run test:e2e:local    # 14+ specova, ~3 min
```

## Test infrastructure

```
Test Suite
  ├── Vitest (unit)
  │   ├── tests/unit/*.test.ts
  │   ├── Pure logic, no DB
  │   └── Brzo (< 5s ukupno)
  │
  └── Playwright (e2e)
      ├── tests/e2e/*.spec.ts
      ├── Real browser (Chromium)
      ├── Hits localhost:3000
      ├── DB through Docker Supabase
      └── Sporo (~3 min ukupno)
```

## Sledeće

- [docker-setup.md](./docker-setup.md) — pokreni testno okruženje
- [unit-tests.md](./unit-tests.md) — Vitest detalji
- [e2e-tests.md](./e2e-tests.md) — Playwright detalji
