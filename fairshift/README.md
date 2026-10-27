# FairShift

FairShift is a React + TypeScript + Vite prototype for keeping worker and employer work records visible side by side. It is a demo of recordkeeping and dispute workflows, not a legal determination or an independently adjudicated system.

## Run locally

```bash
npm install
npm run dev
```

## Tests

Run `npm test` for service-level smoke tests covering pay calculations, both seeded disputes, linked case creation, evidence descriptions, review and correction history, unique IDs, localStorage reload persistence, invalid-storage recovery, and demo reset. The smoke tests exercise the data services, not the rendered browser UI.

## Production build

```bash
npm run build
npm run preview
```

## Shared state and persistence

- `src/receiptTypes.ts` defines the shared typed model for workers, worksites, industries, receipts, separate worker/employer reports and confirmations, disagreement cases, evidence descriptions, resolution decisions, and audit events.
- `src/appDataService.ts` is the repository boundary. It persists the complete state as one versioned object under `fairshift.shared-data.v1` in browser `localStorage`.
- Existing Stage 1–4 split storage keys are migrated on first load when the shared key does not exist. Invalid saved data is recovered to a seeded demo state with a visible notice. The Reset demo data action restores the original demo scenario.
- Data is browser-specific. It does not synchronize across devices, browsers, or different people's sessions. Browser storage can be edited or cleared by the browser owner; it is not a tamper-proof audit store.
- Creating a receipt also registers its worker and worksite in the shared typed state. Receipt and case IDs are de-duplicated during normalization, and cases with broken links are filtered out.

## Work Receipts and pay estimates

- Worker-reported and employer-reported hours and confirmations are stored independently. A mismatch stays visible as `Needs attention`; confirmation by one side does not accept the other side's account.
- Pay is calculated separately for each reported-hours account using the receipt's current values, base rate, optional agreed overtime rate/threshold, and recorded unpaid break. Values are estimates, not accepted wages or legal entitlement.
- Overtime terms are receipt-specific demo terms, not universal legal rules.
- Receipt detail includes a simulated SMS-style message preview. No SMS is sent, no phone number is verified, and no identity is authenticated.

## Disagreement Ledger and Resolution Trail

- Each disagreement links to its original receipt and preserves both claims, reason, evidence descriptions, responses, status, and chronological activity.
- Supported case states are Submitted, Under Review, Awaiting Response, Resolved, and Contested. Reviewer actions, responses, outcomes, and contests append application-level audit entries.
- Corrected receipts are new versions linked to the original receipt and case. The original receipt is not overwritten or deleted; corrections include the reason and previous/new values in the trail.
- Evidence is only described unless independently verified outside this prototype. Audit history is application-level history, not tamper-proof or legally certified evidence. Demo role switching is not authentication or access control.

## Demo data

- Construction: Arun Kumar, receipt `FR-0248`, 10 worker-reported hours versus 8 employer-reported hours, ₹100/hour and an explicitly agreed demo overtime rate of ₹150/hour after 8 hours; linked case `DL-0001`.
- Contract Housekeeping: Meena Devi's 5-hour receipt plus Lakshmi Ravi's rate dispute in `DL-0002`: a worker-reported ₹110/hour claim versus the employer-recorded ₹100/hour rate. This is an illustrative claim, not corroborated fact.
- A resolved construction receipt remains in the seed data.

## Vercel

For a Vercel project whose repository root contains this `package.json`, use:

- Framework preset: Vite
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

If the repository contains this project inside a `fairshift/` subdirectory, set Vercel's Root Directory to `fairshift`. The current app uses client-side page state rather than URL routes, so a route rewrite is not needed for the current navigation. No backend or server-side record store is used.
