# Rental Listings Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh Taipei/New Taipei rental listing data in `src/data/listings.js` from 591 plus recent PTT posts, then verify the app still passes tests, build, and audit checks.

**Architecture:** Reuse the existing `scripts/update-data.mjs` pipeline as the source of truth so scraping, filtering, enrichment, and fallback behavior stay consistent with the app. Only patch the scraper or serializer when the run exposes concrete failures or malformed output, then regenerate the data file and rerun verification.

**Tech Stack:** Node.js, Vite, Vitest, JSDOM, curl-based scraping

---

### Task 1: Inspect the current refresh pipeline

**Files:**
- Modify: `docs/superpowers/plans/2026-06-24-rental-listings-refresh.md`
- Review: `scripts/update-data.mjs`
- Review: `scripts/update-data-utils.mjs`
- Review: `src/data/listings.js`

- [ ] **Step 1: Read the current scraper and generated data format**

Run: `Get-Content -Raw scripts/update-data.mjs`
Expected: Existing 591 + PTT scraping flow, filtering rules, and serializer are visible.

- [ ] **Step 2: Read the helper utilities**

Run: `Get-Content -Raw scripts/update-data-utils.mjs`
Expected: Reuse/fallback logic and minimum listing safeguards are visible.

- [ ] **Step 3: Read the generated listing module**

Run: `Get-Content -Raw src/data/listings.js`
Expected: `updatedAt` and `listings` export format are visible for regeneration.

### Task 2: Run the refresh and capture failures

**Files:**
- Modify: `src/data/listings.js`
- Review: `scripts/update-data.mjs`

- [ ] **Step 1: Execute the update script**

Run: `npm run update:data`
Expected: The scraper reports counts, any skipped pages/articles, and writes refreshed listing data.

- [ ] **Step 2: Inspect the updated output**

Run: `Get-Content -Raw src/data/listings.js`
Expected: `updatedAt` changes to the current Taipei time and listing rows are regenerated.

### Task 3: Fix scraper or serialization issues if the run fails

**Files:**
- Modify: `scripts/update-data.mjs`
- Modify: `scripts/update-data-utils.mjs`
- Modify: `src/data/listings.js`
- Test: `scripts/update-data-utils.test.js`
- Test: `src/data/listings.test.js`

- [ ] **Step 1: Patch the smallest failing area**

Edit only the function that caused the bad scrape, malformed output, or failed safeguards.
Expected: The failure is addressed without changing unrelated scraper behavior.

- [ ] **Step 2: Rerun the data refresh**

Run: `npm run update:data`
Expected: The script completes cleanly and writes acceptable listing output.

- [ ] **Step 3: Repeat until the data file is valid**

Run: `Get-Content -Raw src/data/listings.js`
Expected: The file exports valid JavaScript with refreshed listing rows.

### Task 4: Verify the project after refresh

**Files:**
- Test: `src/data/listings.test.js`
- Test: `src/App.test.jsx`
- Test: `src/listingUtils.test.js`
- Test: `src/customConditions.test.js`
- Test: `scripts/update-data-utils.test.js`

- [ ] **Step 1: Run the test suite**

Run: `npm test`
Expected: All Vitest tests pass.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: Vite build completes without errors.

- [ ] **Step 3: Run dependency audit output**

Run: `npm audit --json`
Expected: JSON output is produced for review, even if vulnerabilities are reported.

### Task 5: Summarize the refresh results

**Files:**
- Review: `src/data/listings.js`

- [ ] **Step 1: Compute report metrics from refreshed data**

Collect: total listing count, counts by district, minimum price, number of `isNew` listings, PTT coverage, and any scrape limitations.
Expected: A concise user-facing summary is ready from the final data file and command outputs.
