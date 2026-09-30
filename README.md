# SellerScope — SEO, stats & study for Etsy sellers

SellerScope helps Etsy sellers work out **why their shop is or isn't selling** and what to do about it this week. It combines an Etsy SEO analyser, a shop-stats and traffic dashboard, profiles of the different kinds of Etsy sellers, a 7-day course, and an advisor you can talk to about your shop.

| Tab | What it does |
|---|---|
| **Overview** | Shop health score, last week's numbers with week-over-week changes, the most important findings, and a **personalised 7-day action plan** built from your data and seller type. |
| **SEO Lab** | Scores a listing out of 100 against how Etsy search matches and ranks listings (title, 13 tags, description, photos/video, shipping, attributes), lists the fixes worth the most points, suggests tags, and previews the listing in Etsy mobile search and Google. **Whole-shop mode** audits every listing from Etsy's listings CSV and finds shop-wide issues. |
| **Shop Stats** | Log weekly visits, views, favourites, orders, revenue, ad spend and traffic sources. Charts for visits, revenue and conversion; funnel; traffic-source mix; diagnostics (traffic drops by source, conversion vs your seller type, ads ROAS vs break-even, order value). Imports Etsy's **Orders CSV** (repeat buyers, coupon use, best weekdays) and includes a **fee & profit calculator**. |
| **Seller Types** | Seven kinds of Etsy seller (handmade, personalised gifts, print-on-demand, digital downloads, vintage, craft supplies, artists) × four growth stages. Shows your benchmarks, a side-by-side comparison of all types, and each type's SEO/traffic/pricing playbook. |
| **7-Day Academy** | One lesson a day for a week: how Etsy search works, keywords & titles, tags & attributes, photos & conversion, pricing & fees, traffic sources & ads, reading your stats. Each lesson has a quiz and an "apply it" task. |
| **Advisor** | Chat about your sellers, traffic, listings and pricing. Uses **Claude** when `ANTHROPIC_API_KEY` is set; otherwise answers from the app's built-in rule engine. |

Everything you enter stays in your browser (`localStorage`). CSV files are read in the browser; buyer names and addresses from the orders export are discarded immediately. The advisor only ever receives aggregates — you can see exactly what it gets under **Advisor → What the advisor sees**.

## Quick start

Requires Node.js 20.19+.

```bash
npm install
npm run dev          # http://localhost:8787
```

Click **Explore with a demo shop** on the Overview to try everything with sample data.

### Turn on the AI advisor (optional)

```bash
cp .env.example .env
# then set ANTHROPIC_API_KEY=... in .env
npm run dev
```

The advisor uses `claude-opus-5-5` with streaming, server-side refusal fallbacks and a cached system prompt. Override with `ADVISOR_MODEL` / `ADVISOR_EFFORT` (`low`…`max`, default `medium`). The key stays on the server; the browser never sees it.

### Production

```bash
npm run build
npm start            # serves dist/ and the /api routes on $PORT (default 8787)
```

`/api/advisor` has a small per-IP rate limit, but if you deploy publicly anyone with the URL can spend your API credits — put it behind authentication.

## Getting your data out of Etsy

| Data | Where in Etsy | Used in |
|---|---|---|
| Weekly visits, views, favourites, orders, revenue, traffic sources | Shop Manager → **Stats**, range "Last 7 days" | Shop Stats (enter by hand) |
| Ad spend & ad revenue | Shop Manager → Marketing → **Etsy Ads** | Shop Stats |
| All listings | Settings → Options → **Download Data → Currently for sale listings** | SEO Lab → Whole shop |
| Orders | Settings → Options → **Download Data → Orders** | Shop Stats → Orders export |

## How the SEO score works

100 points across six areas, based on Etsy's public Seller Handbook guidance ("How Etsy Search Works") and common seller practice:

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
  index.ts           Express: /api/health, /api/advisor (SSE), Vite middleware in dev, dist/ in prod
  advisor.ts         Claude call, system prompt, payload validation
src/
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
