import type { WeekStats } from "./metrics";
import { isoDate, weekStartOf } from "./orders";

/**
 * Eight weeks of realistic numbers for a small handmade jewelry shop, used by
 * the "Load sample data" buttons so every screen can be explored before a
 * seller enters their own stats.
 */
const SAMPLE = [
  { visits: 212, views: 468, favorites: 19, orders: 4, revenue: 142, ads: [7, 28], src: [98, 51, 21, 6, 22, 14] },
  { visits: 236, views: 512, favorites: 22, orders: 5, revenue: 171, ads: [7, 34], src: [110, 55, 24, 8, 24, 15] },
  { visits: 251, views: 540, favorites: 24, orders: 5, revenue: 166, ads: [7, 0], src: [118, 58, 25, 9, 25, 16] },
  { visits: 244, views: 520, favorites: 26, orders: 4, revenue: 139, ads: [7, 36], src: [115, 57, 23, 7, 26, 16] },
  { visits: 290, views: 610, favorites: 31, orders: 6, revenue: 214, ads: [10, 62], src: [131, 66, 34, 11, 30, 18] },
  { visits: 318, views: 655, favorites: 35, orders: 6, revenue: 205, ads: [10, 31], src: [142, 70, 38, 12, 36, 20] },
  { visits: 341, views: 702, favorites: 38, orders: 8, revenue: 268, ads: [10, 70], src: [150, 76, 41, 13, 40, 21] },
  { visits: 262, views: 540, favorites: 31, orders: 5, revenue: 181, ads: [10, 38], src: [128, 64, 12, 12, 30, 16] },
];

export function sampleWeeks(today: Date = new Date()): WeekStats[] {
  const thisWeek = new Date(weekStartOf(today) + "T00:00:00Z");
  return SAMPLE.map((s, i) => {
    const start = new Date(thisWeek);
    start.setUTCDate(start.getUTCDate() - 7 * (SAMPLE.length - i));
    const [etsySearch, etsyApp, etsyAds, etsyMarketing, social, direct] = s.src as [number, number, number, number, number, number];
    return {
      id: `sample-${i}`,
      weekStart: isoDate(start),
      visits: s.visits,
      views: s.views,
      favorites: s.favorites,
      orders: s.orders,
      revenue: s.revenue,
      adSpend: s.ads[0],
      adRevenue: s.ads[1],
      sources: { etsySearch, etsyApp, etsyAds, etsyMarketing, social, direct },
    };
  });
}

export const SAMPLE_LISTING = {
  title: "Dainty Gold Initial Necklace, Personalized Letter Necklace, Minimalist Gold Jewelry, Gift for Her, Necklace",
  tags: [
    "initial necklace",
    "letter necklace",
    "gold necklace",
    "necklace",
    "gift for her",
    "personalized",
    "dainty necklace",
    "initial necklaces",
    "minimalist jewelry",
  ],
  description:
    "This listing is for one necklace. Choose your letter at checkout. Thank you for visiting my shop!",
  primaryKeyword: "initial necklace",
  category: "Necklaces",
  photoCount: 6,
  hasVideo: false,
  freeShipping: false,
  attributesComplete: false,
  isDigital: false,
};
