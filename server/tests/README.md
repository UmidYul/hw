# Production Smoke Tests

This folder contains a production-safe smoke suite for API and storefront checks.

## What it covers

- Public pages return HTML (`/`, `/catalog`, `/product`, `/cart`, etc.).
- Core public API health and shape checks:
  - `/api/health`
  - `/api/settings`
  - `/api/categories/visible`
  - `/api/discounts/active`
  - `/api/banners/active`
  - `/api/products` + product detail
  - basic search/category filter behavior
- Promo validation safety checks (`/api/promocodes/validate`).
- Protected endpoint access control (`/api/orders` without auth).
- Optional checkout mutation test (`POST /api/orders`).
- Optional admin auth/protected checks (with optional 2FA).
- Browser UI smoke (Playwright):
  - quick view image is visible
  - quick view close button works
  - size/color filters keep only matching products
  - product page title/price separation baseline check
  - delivery text is rendered

## Run

From `server/`:

```bash
BASE_URL=https://your-domain.com npm run test:prod:smoke
```

PowerShell example:

```powershell
$env:BASE_URL="https://your-domain.com"
npm run test:prod:smoke
```

UI smoke:

```bash
BASE_URL=https://your-domain.com npm run test:prod:ui
```

Run full suite:

```bash
BASE_URL=https://your-domain.com npm run test:prod:all
```

## Environment variables

- `BASE_URL` (required): production URL, e.g. `https://example.com`
- `REQUEST_TIMEOUT_MS` (optional): request timeout, default `15000`
- `RUN_MUTATION_TESTS` (optional): `true` enables data-changing checks (checkout + order status patch)
- `SMOKE_ADMIN_USER` (optional): admin login username for protected checks
- `SMOKE_ADMIN_PASS` (optional): admin login password
- `SMOKE_ADMIN_2FA_CODE` (optional): one-time 2FA code if login requires 2FA

## Recommended production usage

- Daily/CI: run with `RUN_MUTATION_TESTS=false`.
- Pre-release window: run one full check with `RUN_MUTATION_TESTS=true` against a staging-like production copy or during low traffic.

## Playwright browser setup (first run)

From `server/`:

```bash
npx playwright install chromium
```
