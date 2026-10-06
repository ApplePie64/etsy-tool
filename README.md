# SellerScope — SEO, stats & study for Etsy sellers

SellerScope helps Etsy sellers work out **why their shop is or isn't selling** and what to do about it this week. Its core workflow compares your listing with 3–5 listings you choose and turns the differences into an evidence-backed improvement plan. Around it sit a listing checklist, a shop-stats dashboard, profiles of the different kinds of Etsy sellers, a 7-day course, and an advisor you can talk to about your shop.

**Use it online, free:** https://applepie64.github.io/etsy-tool/ (published from `main` by GitHub Pages; the online version runs without AI, and each visitor's data stays in their own browser).

What's built against the project research doc, and what isn't, is in [docs/status.md](docs/status.md).

| Tab | What it does |
|---|---|
| **Compare Listings** | Your listing next to 3–5 listings you chose — **physical products** (handmade, personalised gifts, print-on-demand) or **digital downloads**, detected automatically and switchable. **Quick fill:** copy an Etsy listing page (Ctrl+A, Ctrl+C) and paste it — title, price, currency, description, reviews and (in most browsers) photo count fill in automatically, and you're asked for anything it couldn't read. A side-by-side table of price, photos, video, tags and customer-facing details (physical: materials, size, personalisation, options, production time, shipping, care & safety, packaging; digital: file formats, sizes, software, editing, licence, delivery). Details you've seen in a listing's photos or reviews can be added straight from the table ("Not stated · add") and count as evidence; details no listing mentions fold into one line. Also title/tag phrase coverage, and price position within the same currency. An **improvement plan** that updates live as you type (rules engine, free), with an optional "Write with Claude" version when an API key is set — where every suggestion quotes the listing text it's based on, links Etsy's guidance, and only proposes wording built from your own product facts. Ask follow-up questions, save analyses, download an HTML/Markdown report, and record whether it was useful. |
| **Overview** | Shop health score, last week's numbers with week-over-week changes, the most important findings, and a **personalised 7-day action plan** built from your data and seller type. |
| **SEO Lab** | A 100-point checklist of Etsy's published listing guidance (title, 13 tags, description, photos/video, shipping, attributes) — not Etsy's ranking score and not a prediction. Lists the fixes worth the most points, suggests tags, and previews the listing in Etsy mobile search and Google. **Whole-shop mode** audits every listing from Etsy's listings CSV and finds shop-wide issues. |
| **Shop Stats** | Log weekly visits, orders and revenue (required) plus optional views, favourites, ad spend and traffic sources — blanks stay unknown, never zero. Charts for visits, revenue and conversion; funnel; traffic-source mix; diagnostics (traffic drops by source, conversion vs your seller type, ads ROAS vs break-even, order value). Imports Etsy's **Orders CSV** (repeat buyers, coupon use, best weekdays; other currencies kept separate, cancelled/refunded orders left out) and includes a **fee & profit calculator**. |
| **Seller Types** | Seven kinds of Etsy seller (handmade, personalised gifts, print-on-demand, digital downloads, vintage, craft supplies, artists) × four growth stages. Shows your benchmarks, a side-by-side comparison of all types, and each type's SEO/traffic/pricing playbook. |
| **7-Day Academy** | One lesson a day for a week: how Etsy search works, keywords & titles, tags & attributes, photos & conversion, pricing & fees, traffic sources & ads, reading your stats. Each lesson has a quiz and an "apply it" task. |
| **Advisor** | Chat about your sellers, traffic, listings and pricing. Uses **Claude** when `ANTHROPIC_API_KEY` is set; otherwise answers from the app's built-in rule engine. |

Everything you enter stays in your browser (`localStorage`). CSV files are read in the browser; buyer names and addresses from the orders export are discarded immediately. The advisor only ever receives aggregates — you can see exactly what it gets under **Advisor → What the advisor sees**.

## Hosting it for free (GitHub Pages)

Every push to `main` runs `.github/workflows/deploy-pages.yml`, which tests, builds with `VITE_STATIC=1` (no server, so no AI calls) and publishes `dist/` to GitHub Pages. One-time setup, already done for this repo: **Settings → Pages → Source: GitHub Actions**. The build uses relative paths, so it works at any URL.

To run the AI features you need the Node server instead (below); any host that runs Node works.

## Quick start

Requires Node.js 20.19+.

```bash
npm install
npm run dev          # http://localhost:8787
```

Click **Explore with a demo shop** on the Overview to try everything with sample data.

### Turn on the AI features (optional)

```bash
cp .env.example .env
# then set ANTHROPIC_API_KEY=... in .env
npm run dev
```

The advisor and the comparison plan/chat use `claude-opus-5-5` with server-side refusal fallbacks and a cached system prompt; the plan uses structured outputs and is then checked by the same rules as the offline plan. Override with `ADVISOR_MODEL` / `ADVISOR_EFFORT` (`low`…`max`, default `medium`). The key stays on the server; the browser never sees it.

### Production

```bash
npm run build
npm start            # serves dist/ and the /api routes on $PORT (default 8787); works on Windows too
```

`/api/advisor` has a small per-IP rate limit, but if you deploy publicly anyone with the URL can spend your API credits — put it behind authentication.

## Getting your data out of Etsy

| Data | Where in Etsy | Used in |
|---|---|---|
| Weekly visits, views, favourites, orders, revenue, traffic sources | Shop Manager → **Stats**, range "Last 7 days" | Shop Stats (enter by hand) |
| Ad spend & ad revenue | Shop Manager → Marketing → **Etsy Ads** | Shop Stats |
| All listings | Settings → Options → **Download Data → Currently for sale listings** | SEO Lab → Whole shop |
| Orders | Settings → Options → **Download Data → Orders** | Shop Stats → Orders export |

## How the comparison stays honest

The rules engine computes everything objective (prices, counts, which facts each listing states, phrase coverage); the AI only explains and proposes edits. Every plan — AI or rules — passes a deterministic guard before you see it:

- **Evidence must be real.** Each suggestion cites `listing.field` plus a quote; quotes that aren't in that field are dropped, and a suggestion with no verifiable evidence is removed.
- **No invented product facts.** Suggested wording may only mention formats, sizes, counts, software, licence terms and numbers that appear in *your* listing. Otherwise the wording is removed and you're asked to confirm the fact.
- **No predictions.** Claims about ranking, traffic, sales or revenue (and specific price prescriptions) are removed.
- **Listing text is data.** Instructions hidden in listing text are flagged and ignored; suggestions that repeat them are removed.
- **Unknown stays unknown, currencies stay separate.** Blank fields are "Unknown"; prices are only compared within one currency.

What was removed, and why, is shown under each plan and in the report.

### Evaluation

```bash
npm run eval            # rules engine on four fixtures (representative, incomplete, mixed currency, injection)
npm run eval -- --ai    # also scores Claude's plans (needs ANTHROPIC_API_KEY; uses API credits)
```

Writes a Markdown report to `eval-results/` with pass/fail per acceptance check and how many AI suggestions the guard removed or fixed.

### Data sources

Listings are filled by pasting a copied listing page, typed by hand, or imported from your own listings CSV. Paste import only reads text you copied yourself; nothing is fetched from Etsy. Etsy's API can supply listings, but only with approved API access (Etsy's developer terms disallow scraping), so it isn't wired in. Sample data is fictional and labelled.

## How the SEO checklist works

100 points across six areas, based on Etsy's public Seller Handbook guidance ("How Etsy Search Works") and common seller practice. It measures how completely a listing follows that guidance; it is not Etsy's ranking score and doesn't predict ranking or sales:

| Area | Points | Checks |
|---|---|---|
| Title | 30 | length (≤140, concise), target keyword as an exact phrase, keyword in the first ~40 characters (mobile truncation), not keyword-stuffed, no all-caps |
| Tags | 35 | all 13 used, ≤20 characters, multi-word long-tail phrases, no plural/reordered/category duplicates, reinforce the title, cover different shopper angles (what, who for, occasion, style, material) |
| Description | 15 | depth, keyword in the first sentence (Google snippet), answers buyer questions (size, materials, care, shipping / files) |
| Photos & video | 12 | 10+ photos (Etsy allows 20), a listing video |
| Shipping | 4 | free shipping (US search priority) |
| Attributes | 4 | attributes filled in (they act as extra tags and filters) |

Tag suggestions are built from your own title phrases plus shopper angles your tags miss. They are **ideas to validate in Etsy's search autocomplete**, not search-volume data.

## Benchmarks — a caveat

Etsy doesn't publish category benchmarks. The conversion and order-value ranges per seller type are community rules of thumb meant as a sanity check; your own week-over-week and 4-week trends matter more. Fees and policies (US rates by default) change — check Etsy's current Seller Handbook and fee pages before relying on them.

## Development

```bash
npm test             # unit tests (vitest)
npm run typecheck
```

```
server/
  index.ts           Express: /api/health, /api/advisor, /api/compare/plan, /api/compare/chat; Vite in dev, dist/ in prod
  advisor.ts         shop advisor: Claude call, system prompt, payload validation
  compare.ts         comparison plan (structured output) and follow-up chat
scripts/
  eval-compare.ts    acceptance-check evaluation (npm run eval)
src/
  lib/compare/       listing comparison: attributes, analysis, plan, guard, report, fixtures
  lib/seo/           rules, keyword helpers, listing analyser, bulk CSV audit
  lib/stats/         metrics & diagnostics, fees, orders CSV, sample data
  lib/sellers/       seller archetypes, stages, classifier
  lib/plan/          7-day action plan generator
  lib/academy/       course content and quizzes
  lib/advisor/       context builder and offline advisor
  components/        charts (SVG), UI helpers
  pages/             one component per tab
```

SellerScope is an independent study tool and is not affiliated with or endorsed by Etsy, Inc.
