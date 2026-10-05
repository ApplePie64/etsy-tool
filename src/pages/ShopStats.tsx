import { useMemo, useState } from "react";
import { ColumnChart } from "../components/charts/ColumnChart";
import { LineChart } from "../components/charts/LineChart";
import { compact, shortDate } from "../components/charts/scale";
import { BarList, Funnel, StatTile } from "../components/charts/Tiles";
import { Empty, FindingCard, NumberField } from "../components/ui";
import { ARCHETYPES } from "../lib/sellers/archetypes";
import { calcProfit, priceForMargin, US_FEES } from "../lib/stats/fees";
import { diagnose, money, pct, SOURCE_KEYS, SOURCE_LABELS, sourceShares, summarize, type TrafficSources, type WeekStats } from "../lib/stats/metrics";
import { isoDate, summarizeOrdersCsv, weekStartOf } from "../lib/stats/orders";
import { sampleWeeks } from "../lib/stats/sample";
import { useStore } from "../store";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Money in a known currency; "$" only when it really is USD. */
const cur = (n: number, currency: string | null | undefined) => (!currency || currency === "USD" ? money(n) : `${n.toFixed(2)} ${currency}`);

function lastWeekStart(): string {
  const d = new Date(weekStartOf(new Date()) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 7);
  return isoDate(d);
}

/** Form state: every number starts blank. Blank optional fields are saved as unknown, never as 0. */
interface Draft {
  weekStart: string;
  visits?: number;
  views?: number;
  favorites?: number;
  orders?: number;
  revenue?: number;
  adSpend?: number;
  adRevenue?: number;
  sources: Partial<TrafficSources>;
}

const emptyDraft = (): Draft => ({ weekStart: lastWeekStart(), sources: {} });

export function ShopStats() {
  const { data, update } = useStore();
  const weeks = data.weeks;
  const s = useMemo(() => summarize(weeks), [weeks]);
  const findings = useMemo(
    () => diagnose(weeks, { profile: data.profile, seoAverage: data.audit?.averageScore }),
    [weeks, data.profile, data.audit],
  );
  const bench = ARCHETYPES[data.profile.model];

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Shop Stats</h1>
          <p>
            Log each week from Shop Manager → Stats and see the funnel, traffic sources and week-over-week changes, with diagnostics for a {bench.name.toLowerCase()} shop.
          </p>
        </div>
        <div className="row">
          {weeks.length === 0 && (
            <button className="btn" onClick={() => update({ weeks: sampleWeeks() })}>
              Load sample data
            </button>
          )}
          {weeks.length > 0 && weeks.every((w) => w.id.startsWith("sample-")) && (
            <button className="btn btn-ghost" onClick={() => update({ weeks: [] })}>
              Clear sample data
            </button>
          )}
        </div>
      </div>

      <WeekForm />

      {s.latest ? (
        <>
          <div className="grid grid-4">
            <StatTile label={`Visits · week of ${shortDate(s.latest.weekStart)}`} value={s.latest.visits.toLocaleString("en-US")} delta={s.wow.visits} trend={s.weeks.map((w) => w.visits)} />
            <StatTile label="Orders" value={String(s.latest.orders)} delta={s.wow.orders} trend={s.weeks.map((w) => w.orders)} />
            <StatTile label="Conversion rate" value={pct(s.latest.conversionRate)} delta={s.wow.conversionRate} trend={s.weeks.map((w) => w.conversionRate)} />
            <StatTile label="Revenue" value={money(s.latest.revenue)} delta={s.wow.revenue} trend={s.weeks.map((w) => w.revenue)} />
          </div>

          <div className="grid grid-2">
            <div className="card">
              <div className="card-head">
                <h2>Visits per week</h2>
                <p>{s.trend4.visits !== null ? `${s.trend4.visits >= 0 ? "+" : ""}${pct(s.trend4.visits, 0)} vs previous 4 weeks` : `${s.weeks.length} week(s) logged`}</p>
              </div>
              <LineChart data={s.weeks.map((w) => ({ x: w.weekStart, y: w.visits }))} label="Visits" format={(v) => Math.round(v).toLocaleString("en-US")} tickFormat={compact} />
            </div>
            <div className="card">
              <div className="card-head">
                <h2>Revenue per week</h2>
                <p>AOV last 4 weeks: {s.last4 ? money(s.last4.aov) : "—"}</p>
              </div>
              <ColumnChart data={s.weeks.map((w) => ({ x: w.weekStart, y: w.revenue }))} label="Revenue" format={money} tickFormat={(v) => `$${compact(v)}`} />
            </div>
            <div className="card">
              <div className="card-head">
                <h2>Conversion rate</h2>
                <p>
                  Typical for {bench.name.toLowerCase()}: {pct(bench.conversion.low, 1)}–{pct(bench.conversion.high, 1)}
                </p>
              </div>
              <LineChart data={s.weeks.map((w) => ({ x: w.weekStart, y: w.conversionRate * 100 }))} label="Conversion rate" format={(v) => `${v.toFixed(2)}%`} tickFormat={(v) => `${v}%`} />
            </div>
            <div className="card">
              <div className="card-head">
                <h2>Funnel · last {Math.min(4, s.weeks.length)} weeks</h2>
                <p>Where shoppers drop off</p>
              </div>
              {s.last4 && (
                <>
                  <Funnel
                    steps={[
                      { label: "Visits", value: s.last4.visits },
                      ...(s.last4.favorites !== undefined ? [{ label: "Favourites", value: s.last4.favorites }] : []),
                      { label: "Orders", value: s.last4.orders },
                    ]}
                  />
                  <p className="small muted" style={{ marginTop: 12 }}>
                    {s.last4.viewsPerVisit !== null ? `${s.last4.viewsPerVisit.toFixed(1)} listing views per visit · ` : "Listing views not entered for every week · "}
                    {s.last4.favorites === undefined ? "Favourites not entered for every week · " : ""}
                    {s.last4.orders > 0 ? `${money(s.last4.revenuePerVisit)} revenue per visit` : "No orders yet"}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-2">
            <div className="card">
              <div className="card-head">
                <h2>Traffic sources · last {Math.min(4, s.weeks.length)} weeks</h2>
                <p>Share of visits</p>
              </div>
              {sourceShares(s.last4?.sources).length ? (
                <BarList
                  max={1}
                  items={sourceShares(s.last4?.sources).map((x) => ({
                    key: x.key,
                    label: x.label,
                    value: x.share,
                    display: `${pct(x.share, 0)} · ${x.visits}`,
                  }))}
                />
              ) : (
                <p className="small muted">Add traffic sources when logging a week to see your mix.</p>
              )}
            </div>
            <div className="card">
              <div className="card-head">
                <h2>Diagnostics</h2>
                <p>Rates judged on the last 4 weeks combined</p>
              </div>
              <div className="stack-sm">
                {findings.slice(0, 5).map((f) => (
                  <FindingCard key={f.id} f={f} />
                ))}
              </div>
            </div>
          </div>

          <WeeksTable />
        </>
      ) : (
        <Empty
          title="No weeks logged yet"
          action={
            <button className="btn btn-primary" onClick={() => update({ weeks: sampleWeeks() })}>
              Explore with sample data
            </button>
          }
        >
          In Etsy, open Shop Manager → Stats, pick "Last 7 days", and copy visits, orders, revenue, views and favourites into the form above.
        </Empty>
      )}

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <OrdersImport />
        <ProfitCalculator />
      </div>
    </div>
  );
}

function WeekForm() {
  const { data, update } = useStore();
  const [d, setD] = useState<Draft>(emptyDraft);
  const [open, setOpen] = useState(data.weeks.length === 0);
  const [showSources, setShowSources] = useState(false);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const exists = data.weeks.some((w) => w.weekStart === d.weekStart);

  const missingRequired = (["visits", "orders", "revenue"] as const).filter((k) => d[k] === undefined);
  const save = () => {
    if (missingRequired.length) return;
    const sourcesEntered = SOURCE_KEYS.some((k) => d.sources[k] !== undefined);
    const week: WeekStats = {
      id: `wk-${d.weekStart}`,
      weekStart: d.weekStart,
      visits: d.visits!,
      orders: d.orders!,
      revenue: d.revenue!,
      views: d.views,
      favorites: d.favorites,
      adSpend: d.adSpend,
      adRevenue: d.adRevenue,
      sources: sourcesEntered ? d.sources : undefined,
    };
    update((s) => ({
      weeks: [...s.weeks.filter((w) => w.weekStart !== week.weekStart && !w.id.startsWith("sample-")), week].sort((a, b) =>
        a.weekStart.localeCompare(b.weekStart),
      ),
    }));
    setD({ ...emptyDraft(), weekStart: nextWeek(d.weekStart) });
  };

  if (!open) {
    return (
      <div className="row">
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          + Log a week
        </button>
      </div>
    );
  }

  return (
    <div className="card stack">
      <div className="card-head" style={{ marginBottom: 0 }}>
        <h2>Log a week</h2>
        <button className="btn btn-sm btn-ghost" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <div className="grid grid-4" style={{ gap: 12 }}>
        <label className="field">
          <span>Week starting</span>
          <input type="date" value={d.weekStart} onChange={(e) => set({ weekStart: e.target.value })} />
        </label>
        <NumberField label="Visits" hint="required" value={d.visits} onChange={(v) => set({ visits: v })} />
        <NumberField label="Listing views" hint="optional" value={d.views} onChange={(v) => set({ views: v })} />
        <NumberField label="Favourites" hint="optional" value={d.favorites} onChange={(v) => set({ favorites: v })} />
        <NumberField label="Orders" hint="required" value={d.orders} onChange={(v) => set({ orders: v })} />
        <NumberField label="Revenue" hint="required, $" step={0.01} value={d.revenue} onChange={(v) => set({ revenue: v })} />
        <NumberField label="Etsy Ads spend" hint="optional" step={0.01} value={d.adSpend} onChange={(v) => set({ adSpend: v })} />
        <NumberField label="Revenue from ads" hint="optional" step={0.01} value={d.adRevenue} onChange={(v) => set({ adRevenue: v })} />
      </div>
      <div>
        <button className="btn btn-sm btn-ghost" onClick={() => setShowSources((x) => !x)} aria-expanded={showSources}>
          {showSources ? "▾" : "▸"} Traffic sources (visits per source)
        </button>
        {showSources && (
          <div className="grid grid-3" style={{ gap: 12, marginTop: 8 }}>
            {SOURCE_KEYS.map((k) => (
              <NumberField key={k} label={SOURCE_LABELS[k]} value={d.sources[k]} onChange={(v) => set({ sources: { ...d.sources, [k]: v } })} />
            ))}
          </div>
        )}
      </div>
      <div className="row">
        <button className="btn btn-primary" onClick={save} disabled={!d.weekStart || missingRequired.length > 0}>
          {exists ? "Update week" : "Save week"}
        </button>
        {missingRequired.length > 0 && <span className="tiny muted">Enter {missingRequired.join(", ")} to save. Leave optional fields blank if you don't have them — they stay unknown.</span>}
        {data.weeks.some((w) => w.id.startsWith("sample-")) && <span className="tiny muted">Saving your own week replaces the sample data.</span>}
      </div>
    </div>
  );
}

function nextWeek(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return lastWeekStart();
  d.setUTCDate(d.getUTCDate() + 7);
  return isoDate(d);
}

function WeeksTable() {
  const { data, update } = useStore();
  const s = summarize(data.weeks);
  return (
    <details className="card">
      <summary>All logged weeks ({s.weeks.length})</summary>
      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table>
          <thead>
            <tr>
              <th>Week of</th>
              <th className="num">Visits</th>
              <th className="num">Views</th>
              <th className="num">Favs</th>
              <th className="num">Orders</th>
              <th className="num">Conv.</th>
              <th className="num">Revenue</th>
              <th className="num">AOV</th>
              <th className="num">ROAS</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {[...s.weeks].reverse().map((w) => (
              <tr key={w.id}>
                <td>{w.weekStart}</td>
                <td className="num">{w.visits}</td>
                <td className="num">{w.views ?? "—"}</td>
                <td className="num">{w.favorites ?? "—"}</td>
                <td className="num">{w.orders}</td>
                <td className="num">{pct(w.conversionRate)}</td>
                <td className="num">{money(w.revenue)}</td>
                <td className="num">{w.orders ? money(w.aov) : "—"}</td>
                <td className="num">{w.roas !== null ? `${w.roas.toFixed(1)}×` : "—"}</td>
                <td>
                  <button className="btn btn-sm btn-ghost" aria-label={`Delete week of ${w.weekStart}`} onClick={() => update((st) => ({ weeks: st.weeks.filter((x) => x.id !== w.id) }))}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function OrdersImport() {
  const { data, update } = useStore();
  const [error, setError] = useState<string | null>(null);
  const o = data.orders;
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      update({ orders: summarizeOrdersCsv(await f.text()) });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  };
  return (
    <div className="card stack-sm">
      <div className="card-head" style={{ marginBottom: 4 }}>
        <h2>Orders export</h2>
        {o && (
          <button className="btn btn-sm btn-ghost" onClick={() => update({ orders: null })}>
            Remove
          </button>
        )}
      </div>
      <p className="sub">
        Settings → Options → Download Data → <strong>Orders</strong>. Only totals are kept — buyer names and addresses are discarded in your browser.
      </p>
      <label className="btn" style={{ alignSelf: "flex-start" }}>
        Choose orders CSV
        <input type="file" accept=".csv,text/csv" className="visually-hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {error && (
        <p className="small delta-bad" role="alert">
          {error}
        </p>
      )}
      {o && (
        <div className="stack-sm" style={{ marginTop: 6 }}>
          <div className="grid grid-2" style={{ gap: 10 }}>
            <div className="tile">
              <span className="tile-label">Orders</span>
              <span className="tile-value" style={{ fontSize: "1.3rem" }}>
                {o.orders}
              </span>
              <span className="tiny muted">
                {o.firstDate} → {o.lastDate}
              </span>
            </div>
            <div className="tile">
              <span className="tile-label">Item sales{o.currency ? ` (${o.currency})` : ""}</span>
              <span className="tile-value" style={{ fontSize: "1.3rem" }}>
                {cur(o.sales, o.currency)}
              </span>
              <span className="tiny muted">AOV {cur(o.aov, o.currency)}</span>
            </div>
            <div className="tile">
              <span className="tile-label">Repeat buyers</span>
              <span className="tile-value" style={{ fontSize: "1.3rem" }}>
                {pct(o.repeatBuyerRate, 0)}
              </span>
              <span className="tiny muted">of {o.uniqueBuyers} buyers</span>
            </div>
            <div className="tile">
              <span className="tile-label">Orders using a coupon</span>
              <span className="tile-value" style={{ fontSize: "1.3rem" }}>
                {pct(o.couponRate, 0)}
              </span>
            </div>
          </div>
          {(o.otherCurrencies?.length > 0 || o.excludedCancelled > 0 || o.adjusted > 0) && (
            <div className="callout small stack-sm" style={{ gap: 2 }}>
              {o.otherCurrencies?.length > 0 && (
                <span>
                  Figures above are {o.currency} orders only. Kept separate, not converted:{" "}
                  {o.otherCurrencies.map((x) => `${x.orders} order${x.orders === 1 ? "" : "s"} in ${x.currency} (${cur(x.sales, x.currency)})`).join(", ")}.
                </span>
              )}
              {o.excludedCancelled > 0 && <span>{o.excludedCancelled} cancelled or refunded order(s) left out.</span>}
              {o.adjusted > 0 && <span>{o.adjusted} order(s) have adjusted totals (e.g. partial refunds) that these figures don't reflect.</span>}
            </div>
          )}
          <h3 style={{ marginTop: 8 }}>Orders by weekday</h3>
          <BarList
            items={o.byWeekday.map((n, i) => ({ key: WEEKDAYS[i]!, label: WEEKDAYS[i]!, value: n, display: String(n) }))}
          />
          {o.topCountries.length > 0 && <p className="small muted">Top countries: {o.topCountries.map((c) => `${c.country} (${c.orders})`).join(", ")}</p>}
        </div>
      )}
    </div>
  );
}

function ProfitCalculator() {
  const { data, update } = useStore();
  const [inp, setInp] = useState({ price: 28, shippingCharged: 0, itemCost: 6, shippingCost: 4.5, labourMinutes: 30, hourlyRate: 18 });
  const [offsite, setOffsite] = useState<0 | 0.12 | 0.15>(0);
  const [target, setTarget] = useState(30);
  const rates = { ...US_FEES, offsiteAdsRate: offsite };
  const r = calcProfit(inp, rates);
  const suggested = priceForMargin(inp, target / 100, rates);
  const set = (k: keyof typeof inp) => (v: number | undefined) => setInp((x) => ({ ...x, [k]: v ?? 0 }));
  const cashMargin = r.revenue > 0 ? r.cashProfit / r.revenue : 0;

  return (
    <div className="card stack-sm">
      <div className="card-head" style={{ marginBottom: 4 }}>
        <h2>Profit calculator</h2>
        <p>US Etsy fees by default</p>
      </div>
      <div className="grid grid-2" style={{ gap: 10 }}>
        <NumberField label="Item price" hint="$" step={0.01} value={inp.price} onChange={set("price")} />
        <NumberField label="Shipping charged" hint="$" step={0.01} value={inp.shippingCharged} onChange={set("shippingCharged")} />
        <NumberField label="Materials & packaging" hint="$" step={0.01} value={inp.itemCost} onChange={set("itemCost")} />
        <NumberField label="Actual postage" hint="$" step={0.01} value={inp.shippingCost} onChange={set("shippingCost")} />
        <NumberField label="Your time" hint="minutes" value={inp.labourMinutes} onChange={set("labourMinutes")} />
        <NumberField label="Hourly rate" hint="$" value={inp.hourlyRate} onChange={set("hourlyRate")} />
      </div>
      <div className="row small">
        <span>Order from an Offsite Ad?</span>
        <div className="segmented" role="group" aria-label="Offsite Ads fee">
          {([0, 0.15, 0.12] as const).map((v) => (
            <button key={v} aria-pressed={offsite === v} onClick={() => setOffsite(v)}>
              {v === 0 ? "No" : `${v * 100}%`}
            </button>
          ))}
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <tbody>
            <tr>
              <td>Buyer pays</td>
              <td className="num">{money(r.revenue)}</td>
            </tr>
            {r.fees.map((f) => (
              <tr key={f.label}>
                <td className="muted">− {f.label}</td>
                <td className="num">{money(f.amount)}</td>
              </tr>
            ))}
            <tr>
              <td className="muted">− Materials & postage</td>
              <td className="num">{money(r.costs)}</td>
            </tr>
            <tr>
              <td>
                <strong>Cash profit</strong> <span className="tiny muted">before your time</span>
              </td>
              <td className="num">
                <strong>{money(r.cashProfit)}</strong>
              </td>
            </tr>
            <tr>
              <td className="muted">− Your time</td>
              <td className="num">{money(r.labour)}</td>
            </tr>
            <tr>
              <td>
                <strong>True profit</strong>
              </td>
              <td className={`num ${r.profit < 0 ? "delta-bad" : ""}`}>
                <strong>
                  {money(r.profit)} ({pct(r.margin, 0)})
                </strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="small">
        Etsy fees take <strong>{money(r.totalFees)}</strong> ({pct(r.revenue ? r.totalFees / r.revenue : 0, 0)}) of this order.{" "}
        {r.breakEvenRoas !== null && (
          <>
            Etsy Ads on this item break even at <strong>{r.breakEvenRoas.toFixed(1)}× ROAS</strong>.
          </>
        )}
      </p>
      <div className="row small">
        <label className="row" style={{ gap: 6 }}>
          Target margin
          <input type="number" min={0} max={80} value={target} onChange={(e) => setTarget(Number(e.target.value) || 0)} style={{ width: 70 }} />%
        </label>
        <span>→ price at least <strong>{suggested !== null ? money(suggested) : "n/a"}</strong></span>
      </div>
      <button
        className="btn btn-sm"
        style={{ alignSelf: "flex-start" }}
        onClick={() => update({ profile: { ...data.profile, margin: Math.max(0.01, Math.round(cashMargin * 100) / 100) } })}
        title="Used to judge whether Etsy Ads pay off"
      >
        Use {pct(Math.max(0, cashMargin), 0)} as my shop margin
      </button>
    </div>
  );
}
