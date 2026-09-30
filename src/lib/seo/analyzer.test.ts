import { describe, expect, it } from "vitest";
import { analyzeListing, duplicateTagGroups, type ListingInput } from "./analyzer";
import { auditListingsCsv } from "./bulk";
import { containsPhrase, inferPrimaryKeyword, phraseIndex, phraseKey, stem, tagAngles } from "./keywords";
import { SAMPLE_LISTING } from "../stats/sample";

const strong: ListingInput = {
  title: "Gold Initial Necklace, Dainty Personalized Letter Pendant for Women",
  primaryKeyword: "gold initial necklace",
  tags: [
    "gold initial necklace",
    "letter necklace",
    "personalized necklace",
    "dainty gold pendant",
    "gift for her",
    "bridesmaid gift",
    "birthday gift for mom",
    "minimalist jewelry",
    "monogram necklace",
    "name jewelry gold",
    "custom letter charm",
    "layering necklace",
    "14k gold filled",
  ],
  description:
    "This gold initial necklace is a dainty personalized letter pendant, handmade to order. Made from 14k gold filled chain and a 10mm letter charm. Length options: 16, 18 or 20 inches. Care: remove before showering and store in the pouch provided. Ships in a gift box within 1–3 business days. Choose your letter in the personalization box at checkout, and add a note if you'd like a gift message included with your order.",
  category: "Necklaces",
  photoCount: 12,
  hasVideo: true,
  freeShipping: true,
  attributesComplete: true,
};

describe("keywords", () => {
  it("stems plurals so they compare equal", () => {
    expect(stem("necklaces")).toBe("necklace");
    expect(stem("earrings")).toBe("earring");
    expect(stem("candies")).toBe("candy");
    expect(stem("boxes")).toBe("box");
    expect(stem("glass")).toBe("glass");
  });

  it("builds order-insensitive phrase keys", () => {
    expect(phraseKey("Gold Rings Dainty")).toBe(phraseKey("dainty gold ring"));
  });

  it("matches phrases with stems and finds their position", () => {
    expect(containsPhrase("Dainty Gold Initial Necklaces for Women", "initial necklace")).toBe(true);
    expect(containsPhrase("Necklace with gold initial", "initial necklace")).toBe(false);
    expect(phraseIndex("Dainty Gold Initial Necklace", "initial necklace")).toBe(12);
  });

  it("infers the keyword from the first title segment", () => {
    expect(inferPrimaryKeyword("Boho Macrame Wall Hanging, Large Woven Tapestry")).toBe("boho macrame wall hanging");
  });

  it("recognises shopper angles in tags", () => {
    const angles = tagAngles(["gift for mom", "boho wall hanging", "christmas gift"], "macrame wall hanging");
    expect(angles.has("recipient")).toBe(true);
    expect(angles.has("style")).toBe(true);
    expect(angles.has("occasion")).toBe(true);
    expect(angles.has("product")).toBe(true);
  });
});

describe("analyzeListing", () => {
  it("scores a well-optimised listing highly", () => {
    const r = analyzeListing(strong);
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.grade).toBe("A");
    expect(r.coverage.inTitle).toBe(true);
    expect(r.coverage.frontLoaded).toBe(true);
    expect(r.coverage.inTags).toBe(true);
    expect(r.areas.reduce((s, a) => s + a.maxPoints, 0)).toBe(100);
  });

  it("flags the classic mistakes in the sample listing", () => {
    const r = analyzeListing(SAMPLE_LISTING);
    const failing = new Set(r.priorities.map((c) => c.id));
    expect(r.score).toBeLessThan(70);
    expect(failing.has("tags-count")).toBe(true); // 9 of 13
    expect(failing.has("tags-duplicates")).toBe(true); // initial necklace(s), "necklace" = category
    expect(failing.has("title-stuffing")).toBe(true); // "necklace" 4x
    expect(failing.has("desc-length")).toBe(true);
    expect(failing.has("video")).toBe(true);
    // priorities are ordered by points lost
    const lost = r.priorities.map((c) => c.maxPoints - c.points);
    expect([...lost].sort((a, b) => b - a)).toEqual(lost);
  });

  it("rejects titles and tags over Etsy's limits", () => {
    const r = analyzeListing({ ...strong, title: "x".repeat(141), tags: [...strong.tags.slice(0, 12), "this tag is far too long for etsy"] });
    expect(r.checks.find((c) => c.id === "title-length")?.status).toBe("fail");
    expect(r.checks.find((c) => c.id === "tags-valid")?.status).not.toBe("pass");
  });

  it("doesn't reward a single broad word as the inferred keyword", () => {
    const r = analyzeListing({ ...strong, title: "Necklace", primaryKeyword: "" });
    expect(r.checks.find((c) => c.id === "title-keyword")?.status).toBe("warn");
  });

  it("handles an empty listing without throwing", () => {
    const r = analyzeListing({ title: "", tags: [], description: "", photoCount: 0, hasVideo: false, freeShipping: false, attributesComplete: false });
    expect(r.score).toBeLessThan(10);
    expect(r.grade).toBe("F");
  });

  it("suggests valid, new, multi-word tags", () => {
    const r = analyzeListing(SAMPLE_LISTING);
    expect(r.tagSuggestions.length).toBeGreaterThan(3);
    const existing = new Set(SAMPLE_LISTING.tags.map(phraseKey));
    for (const t of r.tagSuggestions) {
      expect(t.length).toBeLessThanOrEqual(20);
      expect(t.split(" ").length).toBeGreaterThanOrEqual(2);
      expect(existing.has(phraseKey(t))).toBe(false);
    }
  });

  it("treats digital listings as not needing shipping or materials", () => {
    const r = analyzeListing({ ...strong, freeShipping: false, isDigital: true });
    expect(r.checks.find((c) => c.id === "free-shipping")?.status).toBe("pass");
  });
});

describe("duplicateTagGroups", () => {
  it("groups plural and reordered duplicates", () => {
    const g = duplicateTagGroups(["gold ring", "gold rings", "ring gold", "silver ring"]);
    expect(g).toHaveLength(1);
    expect(g[0]).toHaveLength(3);
  });
});

describe("auditListingsCsv", () => {
  const csv = [
    "TITLE,DESCRIPTION,PRICE,CURRENCY_CODE,QUANTITY,TAGS,MATERIALS,IMAGE1,IMAGE2,IMAGE3,SKU",
    `"Boho Macrame Wall Hanging, Large Woven Tapestry","Handmade macrame wall hanging in natural cotton, 24 x 36 inches.",45.00,USD,3,"macrame wall hanging,boho wall decor,woven tapestry",cotton,https://a/1.jpg,https://a/2.jpg,,MAC-1`,
    `"Mug","A mug.",12.00,USD,10,"mug",ceramic,https://a/1.jpg,,,MUG-1`,
  ].join("\n");

  it("audits every listing and sorts worst first", () => {
    const res = auditListingsCsv(csv, { freeShipping: true, attributesComplete: true, isDigital: false });
    expect(res.listings).toBe(2);
    expect(res.rows[0]!.title).toBe("Mug");
    expect(res.rows[1]!.photoCount).toBe(2);
    expect(res.rows[1]!.tagCount).toBe(3);
    expect(res.commonIssues[0]!.count).toBeGreaterThanOrEqual(1);
    expect(res.commonIssues.some((i) => i.id === "video")).toBe(false);
  });

  it("explains a wrong file", () => {
    expect(() => auditListingsCsv("foo,bar\n1,2", { freeShipping: false, attributesComplete: false, isDigital: false })).toThrow(/TITLE/);
  });
});
