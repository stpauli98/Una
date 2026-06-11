# Domena — upmakeup.ba

## Info

| Polje | Vrijednost |
|-------|-----------|
| Domain | `upmakeup.ba` |
| Registrar | Globalhost (BiH reseller) |
| Nameservers | `ns1.vercel-dns.com`, `ns2.vercel-dns.com` |
| TLD registry | UTIC.NET.BA (BiH .ba registar) |
| Cijena | ~50 KM/godina |

## DNS setup

### Trenutni nameservers

Vercel managed. Sve DNS records su unutar Vercel-a.

### Records (auto by Vercel)

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `216.198.79.1` | 60s |
| CNAME | `www` | `7d81a8f2d95123cc.vercel-dns-017.com.` | 60s |
| TXT | `_vercel` | (verification) | 60s |

### Nadziranje

```bash
dig upmakeup.ba A +short
# → 216.198.79.1

dig www.upmakeup.ba CNAME +short
# → 7d81a8f2d95123cc.vercel-dns-017.com.

dig upmakeup.ba NS +short
# → ns1.vercel-dns.com.
# → ns2.vercel-dns.com.
```

## Setup istorija

### 1. Domena kupljena (Globalhost)

Una je registrovala domenu kroz Globalhost-ov panel.

### 2. Postavljen Vercel DNS

Globalhost panel → My Domains → upmakeup.ba → Name serveri:

- Odabrano "Koristi druge nameservere"
- DNS server 1: `ns1.vercel-dns.com`
- DNS server 2: `ns2.vercel-dns.com`

Globalhost je obavjestio UTIC. UTIC propagirao za ~2h.

### 3. Vercel dodao domenu

Vercel Dashboard → Project → Settings → Domains → Add → `upmakeup.ba`

Vercel automatski generišu A + CNAME records.

### 4. SSL automatski

Let's Encrypt cert generisan na request. Aktivan unutar minuta.

## SSL

| | |
|---|---|
| Issuer | Let's Encrypt |
| Validity | 90 dana (auto-renew) |
| Wildcard | Ne (samo `upmakeup.ba` + `www.upmakeup.ba`) |
| HSTS | Da, 2 godine (Vercel) |

## www vs apex

| URL | Status |
|-----|--------|
| `https://upmakeup.ba` | Primary |
| `https://www.upmakeup.ba` | Redirect → `upmakeup.ba` |
| `http://upmakeup.ba` | HSTS → `https://upmakeup.ba` |

Konfigurisano kroz Vercel Domains tab.

## Subdomain za API/admin?

Trenutno admin je na istom domenu (`/admin/...`).

Alternativa: `admin.upmakeup.ba` poseban Vercel deployment. Trade-off:
- ✅ Cleaner separation
- ✅ Drugačiji RLS / env
- ❌ Više management overhead

Trenutno: monolith struktura adekvatna.

## Email handling

DNS nije konfigurisan za email. `info@upmakeup.ba` ne radi (nema MX records).

Ako Una želi email kroz domenu:

1. Setup email forwarding (npr. Cloudflare, ImprovMX, ZoneEdit)
2. Dodaj MX record kroz Vercel DNS
3. Konfiguriši forward na Unin Gmail

Trenutno: Una koristi `peranovicuna6@gmail.com` direktno.

## Diagnostika

### Trace DNS

```bash
nslookup upmakeup.ba
# Adresa, server koji odgovara

dig +trace upmakeup.ba
# Cijeli DNS chain od root → TLD → authoritative
```

### Provjeri SSL

```bash
openssl s_client -connect upmakeup.ba:443 -servername upmakeup.ba
# Cert info
```

Ili online: https://www.ssllabs.com/ssltest/ → unesi `upmakeup.ba`.

### Provjeri redirects

```bash
curl -I -L https://upmakeup.ba
curl -I -L http://upmakeup.ba
curl -I -L https://www.upmakeup.ba
```

Svi treba da završe na `https://upmakeup.ba` (status 200).

## Edge cases

### Klijent posjeti `www.upmakeup.ba`

Vercel issue-ovan redirect `301 Moved Permanently` na `https://upmakeup.ba`.

### Klijent posjeti `http://upmakeup.ba`

HSTS header navodi browser da auto-upgrade na HTTPS. Plus Vercel issue-ovan redirect.

### Klijent na old browser-u bez HSTS

Direktan HTTP request → Vercel issue-ovan `301` redirect na HTTPS.

### Klijent posjeti tipo (`upmakup.ba`)

Ako domain ne postoji → DNS NXDOMAIN error. Niko ne kontroliše.

Mogli bismo registrovati popularne typo-e (`upmakup.ba`, `upmakeup.com`...) i redirect-ovati. TBD.

## Future considerations

### CDN — Cloudflare

Mogli bismo postaviti Cloudflare ispred Vercel-a:
- DDoS protection
- Extra cache layer
- Geographic routing
- Web Analytics

Trade-off: kompleksnije DNS, double layer. Trenutno: ne potrebno.

### Wildcard subdomains

Ako se ikad treba (npr. tenant per subdomain), Vercel podržava wildcard certs sa Pro tier-om.

## Sledeće

- [vercel.md](./vercel.md) — kako Vercel integriše domenu
- [env-vars.md](./env-vars.md) — `NEXT_PUBLIC_SITE_URL`
