# MilPay Budget Web Prototype

A static web prototype for a military pay, BAH, budgeting, debt-payoff, and retirement planner. Dark UI, no build step.

## Run locally

From the repo root:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy

No build step. Deploy the repo root as the site root.

- Netlify: publish directory `.` (config in `netlify.toml`)
- Vercel: framework preset `Other`, output directory `.` (config in `vercel.json`)
- Cloudflare Workers / Pages: `wrangler.jsonc` exposes the root as the asset directory
- GitHub Pages: publish the branch root

## Features

- **Plan** – grade, YOS, ZIP, dependents, special pays, deductions, TSP rate, tax withholding presets; resolves duty ZIP → MHA → BAH locality
- **Expenses** – fill-in-the-blank ledger with planned / actual columns and per-row status
- **Debt** – avalanche / snowball / custom payoff order, Plan-surplus scenarios, payoff chart and full amortization schedule
- **Retirement Benefits** – High-3 vs BRS comparison with TSP growth, government match (BRS only), COLA, withdrawal-rate assumptions, and USAF average promotion timing
- **Scenarios** – what-if deltas on grade, YOS, ZIP, dependents, pays, deductions, TSP, and expenses

## Workflow extras

- **Auto-save** to this browser's `localStorage` – your inputs survive a refresh
- **Reset planner** button (sidebar) wipes the saved state after a confirm prompt
- **CSV export** on the Expenses, Debt, and Retirement tabs
- **Print stylesheet** strips chrome and reformats panels for clean PDF / paper output

## Production notes

The site ships embedded pay and BAH rate tables along with a local ZIP-to-MHA resolver derived from public 2026 BAH calculator data. A production version should hydrate signed pay, ZIP-to-MHA, and BAH snapshots from official DFAS and DTMO releases and share the same calculation engine with the planned iOS app.
