# Project status against the research doc

Status of SellerScope against *Etsy AI tool: research and one-week project scope* (30 September 2026). Updated 6 October 2026.

**Legend:** ✅ built and tested · 🟡 built with limits · ⛔ not built (blocked or deliberately deferred) · 👤 needs a person, not code

## Recommended MVP

The core workflow is built: **provide a listing and comparison examples → inspect a comparison table → ask a question → receive an evidence-backed improvement plan**. It lives in the **Compare Listings** tab.

| Requirement | Status | Notes |
|---|---|---|
| One seller category, English listings | ✅ | Two: digital downloads and physical products (handmade, personalised, print-on-demand), detected from the listings and switchable. Sellers can add details they've seen in photos or reviews ("Material: stoneware"); these are quoted as evidence like listing text. Fact extraction is English-only. |
| Comparison set of 3–5 items | ✅ | Up to 5 comparison listings; warns below 3. |
| Permitted API input when ready; otherwise seller-supplied details and labelled sample data | 🟡 | Paste-to-fill (copy an Etsy listing page, paste it), manual entry and your own listings CSV work. Sample data is fictional and labelled everywhere it appears, including the report. Etsy API import isn't built: it needs approved API access, and Etsy's terms rule out scraping. |
| Price/currency, product attributes, title/tag coverage, customer-facing differences | ✅ | Side-by-side table, phrase coverage table, and price position within one currency. |
| AI explanations tied to input fields and official guidance | 🟡 | Every suggestion cites `listing.field` plus a quote and links the Etsy guidance it relies on. Tested against a stand-in for the Claude API; not yet run against the live API (no key in the build environment). |
| Suggested edits that preserve product facts and request missing details | ✅ | Wording that states a fact your listing doesn't is removed, and you're asked to confirm the fact instead. |
| Saved analyses and a downloadable report | ✅ | Autosaved in the browser. HTML (print to PDF) and Markdown reports, with dates, evidence and anything the safety checks removed. |
| Rules engine calculates, AI explains; no vector DB, training or multi-agent | ✅ | |
| Don't invent an Etsy algorithm score or guarantee ranking | ✅ | The SEO Lab score is labelled a checklist, not Etsy's ranking score. Ranking, traffic and sales claims are removed from plans. |

## Acceptance checks

All are automated in `src/lib/compare/compare.test.ts`. `npm run eval` runs them over four fixtures: representative, incomplete, mixed currency and injection.

| Check | Status | How |
|---|---|---|
| Calculations match known answers | ✅ | Medians, price position and rank, photo median, phrase counts. |
| Currencies are not silently mixed | ✅ | Comparisons only compare within your currency and say which listings were left out. The orders CSV now totals each currency separately. |
| Missing data stays unknown | ✅ | Blank fields show "Unknown". A fact is never called "missing" when there's no description to check. Weekly stats no longer turn blank views or favourites into 0. |
| Recommendations reference supplied facts | ✅ | Quotes are verified against the cited field. Suggestions without verifiable evidence are removed. |
| Invented product attributes rejected | ✅ | Formats, sizes, counts, software, licence terms and numbers are checked against your own listing. |
| Unsupported sales claims rejected | ✅ | Ranking, sales, revenue and traffic predictions and specific price prescriptions are removed. |
| Embedded instructions don't derail it | ✅ / 🟡 | Instruction-like listing text is flagged. Suggestions or summary sentences that repeat it are removed. Analysis results are identical with or without the injected text. The live model's behaviour still needs `npm run eval -- --ai`. |
| Irrelevant questions don't derail it | ✅ / 🟡 | The offline chat gives a scope reply. The AI chat is instructed to do the same; not yet tested against the live model. |

## Data feasibility

| Feature | Status | Notes |
|---|---|---|
| Review a seller's listing text, tags and price | ✅ | Listings CSV parser built from Etsy's documented columns. Check it against a real export. |
| Order analysis | 🟡 | Removes duplicate order IDs, separates currencies, excludes cancelled/refunded orders, and counts adjusted totals without applying them. The order-items CSV join isn't built. |
| Traffic and conversion | 🟡 | Separately dated weekly stats, entered by hand in Shop Stats. Optional. |
| Public listing discovery (Etsy API) | ⛔ | Needs approved API access. |
| Keyword demand | ⛔ | No permitted data route. The app shows how many of *your chosen* listings use a phrase (labelled "not search volume") and links Etsy Marketplace Insights. |
| Competitor sales/revenue estimates | ⛔ | Deliberately not built, per the doc. |
| Historical trends | ⛔ | Only your own logged weeks. |

## Deferred in the doc

Not built: own sales estimator, historical trend database, live traffic integration, automatic listing edits, billing, browser extension.

These already existed before the doc and were kept as optional extras: **Shop Stats** (manual dated stats), **7-Day Academy** (learning content), **SEO Lab**, **Seller Types** and the shop **Advisor**. They follow the same honesty rules.

## Validation gates (people, not code)

| Gate | Status |
|---|---|
| A seller-permitted listing export | 👤 Needs a real seller. |
| Confirm Etsy API access | 👤 Needs an Etsy developer account and app approval. |
| One manual comparison with three useful suggestions | 🟡 The fictional sample has one worked comparison. Repeat it with a real listing. |
| Ask 3–5 sellers whether it changes a decision | 👤 Each analysis records "Did it change what you'll do?" and "Would you use it again?" (included in the report), so interview answers have somewhere to go. The threshold in the doc is 2 of 5 asking to reuse it. |

## Seven-day plan

| Day | Deliverable | Status |
|---|---|---|
| 1 | Verify inputs, narrow task, manual example | 🟡 Digital downloads chosen; sample example built; a real export is still needed. |
| 2 | Input/import flow and comparison table | ✅ |
| 3 | Deterministic calculations and listing checks | ✅ |
| 4 | Grounded AI analysis and follow-up chat | 🟡 Built; verified against a stand-in API only. |
| 5 | Suggested edits, evidence display, saved results | ✅ |
| 6 | Edge cases and seller feedback | 🟡 Edge-case fixtures and evaluation built; seller feedback 👤. |
| 7 | Fix issues, deploy, document a demo | ✅ Deployed free to GitHub Pages (without AI); demo script below. |

## Demo script (about 3 minutes)

1. Open https://applepie64.github.io/etsy-tool/ (or `npm run dev`). It opens on **Compare Listings**; click **Load sample (fictional)**. To show paste import, click **New comparison**, copy any Etsy listing page and paste it into a **Quick fill** box.
2. **Side by side:** your listing states no sizes, licence or delivery details; three of four others do. Hover a cell to see the text it came from. Sample C is priced in EUR and is left out of the price comparison.
3. **Title & tag phrases:** "monthly budget sheet" is used by 3 of 4, not by you (counts are the chosen listings, not search volume).
4. **Findings:** Sample D hides "IGNORE ALL PREVIOUS INSTRUCTIONS…" in its description. It's flagged and ignored.
5. **Improvement plan:** already there, updating as you edit. Each suggestion quotes its evidence, links Etsy guidance and asks you to confirm facts before adding them.
6. Ask *"How does my price compare?"* and then *"What's the weather?"*: the first gets a grounded answer, the second a scope reply.
7. **Download HTML** for the report and answer the two feedback questions.

## Not yet verified

- **Live Claude calls.** The plan and chat endpoints were tested end-to-end against a stand-in API, which confirmed the request shape, structured output parsing, streaming and guard behaviour. Run `npm run eval -- --ai` with a real key to measure the model.
- **Real Etsy exports.** The CSV parsers follow Etsy's documented columns, but no real export has been run through them yet.
- **Real pasted pages.** The paste parser is tested on page copies modelled on Etsy's layout; check it on real pages and adjust when Etsy changes its layout. The seller sees and can correct every filled field.
