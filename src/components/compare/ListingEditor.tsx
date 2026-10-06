import { useState, type ClipboardEvent } from "react";
import { parseListingPaste } from "../../lib/compare/pasteParser";
import type { CompareListing } from "../../lib/compare/types";
import { ETSY_LIMITS } from "../../lib/seo/rules";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "JPY", "NZD", "CHF", "SEK", "DKK", "NOK", "PLN", "MXN", "SGD", "HKD"];

const numOrNull = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Edits one listing. Every optional field can be left blank, which means
 * "unknown" — the comparison never treats a blank as zero or "no".
 */
export function ListingEditor({
  listing,
  onChange,
  onRemove,
}: {
  listing: CompareListing;
  onChange: (patch: Partial<CompareListing>) => void;
  onRemove?: () => void;
}) {
  const isMine = listing.role === "mine";
  // Keep raw text locally so typing "a, b," isn't reformatted mid-edit.
  const [tagsText, setTagsText] = useState(listing.tags?.join(", ") ?? "");
  const tagCount = listing.tags?.length ?? 0;

  return (
    <div className="stack-sm">
      <QuickFill listing={listing} onChange={onChange} />
      <div className="grid grid-2" style={{ gap: 10 }}>
        <label className="field">
          <span>Name</span>
          <input type="text" value={listing.label} maxLength={80} onChange={(e) => onChange({ label: e.target.value })} />
        </label>
        <label className="field">
          <span>
            Etsy link <span className="field-hint">optional</span>
          </span>
          <input type="text" inputMode="url" value={listing.url ?? ""} placeholder="https://www.etsy.com/listing/…" onChange={(e) => onChange({ url: e.target.value.trim() || null })} />
        </label>
      </div>

      <label className="field">
        <span className="field-label">
          <span>Title</span>
          <span className={`field-hint num${listing.title.length > ETSY_LIMITS.titleMaxChars ? " delta-bad" : ""}`}>
            {listing.title.length}/{ETSY_LIMITS.titleMaxChars}
          </span>
        </span>
        <input type="text" value={listing.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Copy the listing title" />
      </label>

      <label className="field">
        <span className="field-label">
          <span>
            Tags <span className="field-hint">comma-separated · blank = unknown</span>
          </span>
          {listing.tags && <span className="field-hint num">{tagCount}/{ETSY_LIMITS.tagCount}</span>}
        </span>
        <input
          type="text"
          value={tagsText}
          placeholder={isMine ? "budget planner, budget template, …" : "Usually not visible on Etsy — leave blank"}
          onChange={(e) => {
            setTagsText(e.target.value);
            const tags = e.target.value
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
            onChange({ tags: tags.length ? tags : null });
          }}
        />
      </label>

      <label className="field">
        <span>
          Description <span className="field-hint">blank = unknown</span>
        </span>
        <textarea rows={4} value={listing.description ?? ""} onChange={(e) => onChange({ description: e.target.value.trim() ? e.target.value : null })} />
      </label>

      <div className="grid grid-4" style={{ gap: 10 }}>
        <label className="field">
          <span>Price</span>
          <input type="number" min={0} step={0.01} value={listing.price ?? ""} placeholder="Unknown" onChange={(e) => onChange({ price: numOrNull(e.target.value) })} />
        </label>
        <label className="field">
          <span>Currency</span>
          <select value={listing.currency ?? ""} onChange={(e) => onChange({ currency: e.target.value || null })}>
            <option value="">Unknown</option>
            {[...new Set([...(listing.currency ? [listing.currency] : []), ...CURRENCIES])].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Photos</span>
          <input type="number" min={0} max={ETSY_LIMITS.maxPhotos} value={listing.photoCount ?? ""} placeholder="Unknown" onChange={(e) => onChange({ photoCount: numOrNull(e.target.value) })} />
        </label>
        <label className="field">
          <span>Video</span>
          <select value={listing.hasVideo === null ? "" : listing.hasVideo ? "yes" : "no"} onChange={(e) => onChange({ hasVideo: e.target.value === "" ? null : e.target.value === "yes" })}>
            <option value="">Unknown</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        {!isMine && (
          <label className="field">
            <span>
              Reviews <span className="field-hint">optional</span>
            </span>
            <input type="number" min={0} value={listing.reviewCount ?? ""} placeholder="Unknown" onChange={(e) => onChange({ reviewCount: numOrNull(e.target.value) })} />
          </label>
        )}
        <label className="field">
          <span>Recorded on</span>
          <input type="date" value={listing.capturedAt} onChange={(e) => e.target.value && onChange({ capturedAt: e.target.value })} />
        </label>
      </div>
      <label className="field">
        <span>
          Details you've seen <span className="field-hint">optional · one per line, e.g. "Material: stoneware" or "Size: 11 oz" — from photos or reviews</span>
        </span>
        <textarea rows={2} value={listing.notes ?? ""} onChange={(e) => onChange({ notes: e.target.value.trim() ? e.target.value : null })} />
      </label>
      <div className="row tiny muted">
        <span>
          Source: {listing.source === "sample" ? "sample data (fictional)" : listing.source === "csv" ? "your listings CSV" : "entered by you"}
        </span>
        <span className="spacer" />
        {onRemove && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={onRemove}>
            Remove listing
          </button>
        )}
      </div>
    </div>
  );
}

const FIELD_NAMES: Record<string, string> = { title: "title", price: "price", description: "description", reviews: "review count", link: "link", photos: "photo count", video: "video" };

/**
 * Paste box: the seller copies an Etsy listing page (Ctrl+A, Ctrl+C) and
 * pastes it here; the found fields fill in immediately, with an undo.
 */
function QuickFill({ listing, onChange }: { listing: CompareListing; onChange: (patch: Partial<CompareListing>) => void }) {
  const [summary, setSummary] = useState<{
    text: string;
    missing: string[];
    undo: Partial<CompareListing>;
    /** Asked once after a paste and kept visible while the seller answers. */
    askPhotos?: boolean;
    askVideo?: boolean;
  } | null>(null);
  const [value, setValue] = useState("");

  const apply = (text: string, html = "") => {
    const p = parseListingPaste(text, html);
    if (!p.found.length) {
      setSummary({ text: "Couldn't find listing details in that text. Try copying the whole listing page, or type the details below.", missing: [], undo: {} });
      return;
    }
    const patch: Partial<CompareListing> = { source: "manual", capturedAt: new Date().toISOString().slice(0, 10) };
    if (p.title) patch.title = p.title;
    if (p.price !== null) {
      patch.price = p.price;
      patch.currency = p.currency;
    }
    if (p.description) patch.description = p.description;
    if (p.reviewCount !== null && listing.role === "competitor") patch.reviewCount = p.reviewCount;
    if (p.url) patch.url = p.url;
    if (p.photoCount !== null) patch.photoCount = p.photoCount;
    if (p.hasVideo) patch.hasVideo = true;
    if (p.shopName && listing.role === "competitor" && /^Listing \d$/.test(listing.label)) patch.label = p.shopName;
    const undo = Object.fromEntries(Object.keys(patch).map((k) => [k, listing[k as keyof CompareListing]])) as Partial<CompareListing>;
    onChange(patch);
    const missing = [listing.role === "mine" && listing.tags === null ? "your tags" : null].filter((x): x is string => !!x);
    const found = p.found.map((f) => FIELD_NAMES[f] ?? f);
    setSummary({
      text: `Filled in: ${found.join(", ")}${p.currencyAssumed ? " (price read as USD from \"$\" — change the currency if that's wrong)" : ""}. Check them below.`,
      missing,
      undo,
      askPhotos: (patch.photoCount ?? listing.photoCount) === null,
      askVideo: (patch.hasVideo ?? listing.hasVideo) === null,
    });
    setValue("");
  };

  return (
    <div className="quickfill">
      <label className="field">
        <span>
          Quick fill <span className="field-hint">on the Etsy listing page press Ctrl+A then Ctrl+C (⌘A, ⌘C on Mac), then paste here</span>
        </span>
        <textarea
          rows={2}
          value={value}
          placeholder="Paste the listing page here…"
          onChange={(e) => setValue(e.target.value)}
          onPaste={(e: ClipboardEvent<HTMLTextAreaElement>) => {
            const text = e.clipboardData.getData("text");
            if (text.trim()) {
              e.preventDefault();
              apply(text, e.clipboardData.getData("text/html"));
            }
          }}
          onBlur={() => value.trim() && apply(value)}
        />
      </label>
      {summary && (
        <div className="small quickfill-result" role="status">
          <span>{summary.text}</span>
          {summary.missing.length > 0 && <span className="muted"> Add by hand: {summary.missing.join(", ")}.</span>}
          {(summary.askPhotos || summary.askVideo) && (
            <span className="row quick-ask">
              {summary.askPhotos && (
                <label className="row" style={{ gap: 4 }}>
                  Photos on the listing:
                  <input
                    type="number"
                    min={0}
                    max={ETSY_LIMITS.maxPhotos}
                    style={{ width: 64 }}
                    aria-label="Number of photos"
                    value={listing.photoCount ?? ""}
                    onChange={(e) => onChange({ photoCount: numOrNull(e.target.value) })}
                  />
                </label>
              )}
              {summary.askVideo && (
                <span className="row" style={{ gap: 4 }} role="group" aria-label="Has a video">
                  Video?
                  <button type="button" className="btn btn-sm" aria-pressed={listing.hasVideo === true} onClick={() => onChange({ hasVideo: true })}>
                    Yes
                  </button>
                  <button type="button" className="btn btn-sm" aria-pressed={listing.hasVideo === false} onClick={() => onChange({ hasVideo: false })}>
                    No
                  </button>
                </span>
              )}
            </span>
          )}
          {Object.keys(summary.undo).length > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                onChange(summary.undo);
                setSummary(null);
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
