import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AdvisorState } from "./lib/advisor/context";
import type { Plan } from "./lib/compare/plan";
import type { Feedback } from "./lib/compare/report";
import type { Category, CompareListing } from "./lib/compare/types";
import type { ListingInput } from "./lib/seo/analyzer";
import { analyzeListing } from "./lib/seo/analyzer";
import type { BulkAuditSummary } from "./lib/seo/bulk";
import { DEFAULT_PROFILE, type SellerProfile } from "./lib/sellers/archetypes";
import type { WeekStats } from "./lib/stats/metrics";
import type { OrdersSummary } from "./lib/stats/orders";
import { TABS, type TabId } from "./lib/tabs";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** The bulk audit without per-check detail, small enough for localStorage. */
export type SavedAudit = Pick<BulkAuditSummary, "listings" | "averageScore" | "gradeCounts" | "commonIssues"> & {
  rows: { title: string; score: number; grade: string; topIssue: string; tagCount: number; photoCount: number; price: number }[];
};

/** A saved listing comparison (autosaved as the seller edits it). */
export interface SavedComparison {
  id: string;
  name: string;
  category: Category;
  createdAt: string;
  updatedAt: string;
  /** When the listings last changed; a plan older than this is stale. */
  listingsUpdatedAt: string;
  listings: CompareListing[];
  plan: Plan | null;
  chat: ChatTurn[];
  feedback: Feedback;
}

export interface AppData {
  profile: SellerProfile;
  profileSet: boolean;
  weeks: WeekStats[];
  draft: ListingInput;
  audit: SavedAudit | null;
  orders: OrdersSummary | null;
  planDone: Record<string, boolean>;
  academy: { completed: number[]; quiz: Record<number, number> };
  chat: ChatTurn[];
  comparisons: SavedComparison[];
  activeComparison: string | null;
}

export const EMPTY_DRAFT: ListingInput = {
  title: "",
  tags: [],
  description: "",
  primaryKeyword: "",
  category: "",
  photoCount: 0,
  hasVideo: false,
  freeShipping: false,
  attributesComplete: false,
  isDigital: false,
};

const INITIAL: AppData = {
  profile: DEFAULT_PROFILE,
  profileSet: false,
  weeks: [],
  draft: EMPTY_DRAFT,
  audit: null,
  orders: null,
  planDone: {},
  academy: { completed: [], quiz: {} },
  chat: [],
  comparisons: [],
  activeComparison: null,
};

const STORAGE_KEY = "sellerscope:v1";

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      ...INITIAL,
      ...parsed,
      profile: { ...DEFAULT_PROFILE, ...parsed.profile },
      draft: { ...EMPTY_DRAFT, ...parsed.draft },
      academy: { ...INITIAL.academy, ...parsed.academy },
    };
  } catch {
    return INITIAL;
  }
}

interface Store {
  data: AppData;
  update: (patch: Partial<AppData> | ((d: AppData) => Partial<AppData>)) => void;
  reset: () => void;
  tab: TabId;
  go: (tab: TabId) => void;
  advisorState: AdvisorState;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load);
  const [tab, setTab] = useState<TabId>(() => {
    const h = location.hash.replace("#", "") as TabId;
    return TABS.some((t) => t.id === h) ? h : "overview";
  });

  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // Storage full or blocked: the app keeps working for this session.
      }
    }, 250);
  }, [data]);

  useEffect(() => {
    const onHash = () => {
      const h = location.hash.replace("#", "") as TabId;
      if (h) setTab(h);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const update = useCallback<Store["update"]>((patch) => {
    setData((d) => ({ ...d, ...(typeof patch === "function" ? patch(d) : patch) }));
  }, []);

  const reset = useCallback(() => setData(INITIAL), []);

  const go = useCallback((t: TabId) => {
    setTab(t);
    if (location.hash !== `#${t}`) history.replaceState(null, "", `#${t}`);
    window.scrollTo({ top: 0 });
  }, []);

  const advisorState = useMemo<AdvisorState>(() => {
    const d = data.draft;
    return {
      profile: data.profile,
      weeks: data.weeks,
      audit: data.audit,
      lastListing: d.title.trim() ? { title: d.title, report: analyzeListing(d) } : null,
      orders: data.orders,
    };
  }, [data.profile, data.weeks, data.audit, data.draft, data.orders]);

  const value = useMemo(() => ({ data, update, reset, tab, go, advisorState }), [data, update, reset, tab, go, advisorState]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
