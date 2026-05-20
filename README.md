# MilPay Budget Web Prototype

This is a static website prototype for the military pay and budgeting planner.

## Run Locally

From this folder:

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Deploy

This is a static site with no build step. Deploy the `MilPayBudgetWeb` folder as the site root.

- Netlify: publish directory `.`
- Vercel: framework preset `Other`, output directory `.`
- GitHub Pages: publish the folder contents from the selected branch
- Any static host: upload `index.html`, CSS, JS, and data files together

## Included Workflows

- Pay and allowance dashboard
- Blank service profile inputs
- Basic pay, BAH, BAS, TSP, deductions, tax, and extra-income calculation
- Duty ZIP resolver paired to public ZIP-to-MHA data and workbook BAH rate tables
- Tax withholding presets and manual percentage inputs against taxable pays
- Budget summary with add/delete fill-in-the-blank expense rows
- Debt payoff workspace with add/delete editable debt rows, avalanche/snowball/custom priority ordering, Plan-surplus scenarios, payoff graphics, and amortization schedules
- Retirement Benefits comparison using the Plan tab profile, service member age, High-3 pension, BRS pension, member TSP contribution, no High-3 government match, 5% BRS match, starting balance, monthly compounding, COLA, withdrawal assumptions, and USAF average time-in-grade promotion timing
- Scenario comparison using user-selected grade, YOS, duty ZIP, dependent status, pay, deduction, TSP, and expense changes

## Production Notes

The site currently uses embedded pay and BAH rate data generated from the workbook's rate tables plus a local ZIP-to-MHA resolver copied from public 2026 BAH calculator data. A production version should load signed pay, ZIP-to-MHA, and BAH snapshots from official DFAS and DTMO releases, then share the same calculation engine with the later iOS app.
