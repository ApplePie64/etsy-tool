import { useState } from "react";
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
