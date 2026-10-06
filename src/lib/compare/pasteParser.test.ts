import { describe, expect, it } from "vitest";
import { parseListingPaste } from "./pasteParser";

/*
 * Fixtures imitate what Ctrl+A / Ctrl+C on an Etsy listing page produces:
 * navigation, breadcrumbs, the buy box, item details, policies and reviews.
 * Real pages vary, which is why the app shows what was found for the seller
 * to check.
 */

const FULL_PAGE = `Skip to Content
Etsy
Search for anything
Sign in
Cart
Gifts
Home Favorites
Paper & Party Supplies
Paper
Calendars & Planners
In 20+ carts
Price:
$5.99
Original Price: $11.98
(50% off)
Sale ends in 23:14:05
Local taxes included (where applicable)
Budget Planner Printable | Monthly Budget Sheet | Finance Tracker | A4 & US Letter PDF
PlannerStudio
Star Seller
4.9 out of 5 stars
Digital download
Add to cart
Item details
Highlights
Designed by PlannerStudio
Digital download
Digital file type(s): 1 PDF
Instant download monthly budget planner. 12 pages including a yearly overview, monthly budget sheet, bill tracker and savings tracker.
Files: PDF in A4 and US Letter sizes. Print at home or at a print shop.
For personal use only. No physical item will be shipped.
Learn more about this item
Delivery and return policies
Instant Download
Your files will be available to download once payment is confirmed.
Meet your seller
Reviews for this item (1,240)
Love it, so easy to print!
Explore related searches
budget planner
https://www.etsy.com/listing/1234567890/budget-planner-printable?ref=hp_rv-1`;

const GBP_PAGE = `Etsy
Search for anything
Home & Living
Sale Price £4.20
£4.20
Original Price £8.40
(50% off)
Wildflower SVG Bundle, Cricut Cut Files, Floral SVG PNG DXF
MeadowDesigns
4.8
(312)
Star Seller
Add to basket
Description
30 designs as SVG, PNG and DXF files. Commercial licence included for small businesses.
This is a digital download; nothing will be shipped.
Read the full description
Shipping and return policies
Reviews for this item 89`;

const SHORT_PASTE = `Editable Wedding Seating Chart Template, Canva Seating Plan
Edit in Canva with a free account. Includes 3 sizes: 18x24, 24x36 and A2. Instant download, no physical item.`;

const EURO_PAGE = `Prix :
6,50 €
Budget Spreadsheet Google Sheets, Monthly Budget Planner, Paycheck Budget Template
Item details
Google Sheets budget template that calculates totals automatically. Works on desktop and mobile.
1.2k reviews`;

describe("parseListingPaste", () => {
  it("reads a full desktop listing page", () => {
    const p = parseListingPaste(FULL_PAGE);
    expect(p.title).toBe("Budget Planner Printable | Monthly Budget Sheet | Finance Tracker | A4 & US Letter PDF");
    expect(p.price).toBe(5.99); // the sale price, not the original
    expect(p.currency).toBe("USD");
    expect(p.currencyAssumed).toBe(true);
    expect(p.description).toMatch(/^Designed by PlannerStudio/);
    expect(p.description).toMatch(/No physical item will be shipped\.$/);
    expect(p.description).not.toMatch(/Delivery and return|Love it/);
    expect(p.reviewCount).toBe(1240);
    expect(p.shopName).toBe("PlannerStudio");
    expect(p.url).toBe("https://www.etsy.com/listing/1234567890/budget-planner-printable");
    expect(p.found).toEqual(expect.arrayContaining(["title", "price", "description", "reviews", "link"]));
  });

  it("reads sale prices in pounds and a Description section", () => {
    const p = parseListingPaste(GBP_PAGE);
    expect(p.title).toBe("Wildflower SVG Bundle, Cricut Cut Files, Floral SVG PNG DXF");
    expect(p.price).toBe(4.2);
    expect(p.currency).toBe("GBP");
    expect(p.currencyAssumed).toBe(false);
    expect(p.description).toMatch(/^30 designs as SVG/);
    expect(p.description).not.toMatch(/Read the full description/);
    expect(p.reviewCount).toBe(89);
  });

  it("handles a paste of just the title and description", () => {
    const p = parseListingPaste(SHORT_PASTE);
    expect(p.title).toBe("Editable Wedding Seating Chart Template, Canva Seating Plan");
    expect(p.description).toMatch(/^Edit in Canva/);
    expect(p.price).toBeNull();
    expect(p.currency).toBeNull();
    expect(p.found).not.toContain("price");
  });

  it("reads European number formats and k-style review counts", () => {
    const p = parseListingPaste(EURO_PAGE);
    expect(p.price).toBe(6.5);
    expect(p.currency).toBe("EUR");
    expect(p.title).toBe("Budget Spreadsheet Google Sheets, Monthly Budget Planner, Paycheck Budget Template");
    expect(p.description).toMatch(/^Google Sheets budget template/);
    expect(p.reviewCount).toBe(1200);
  });

  it("doesn't take free-shipping thresholds or prose as the price", () => {
    const p = parseListingPaste(`Free shipping on orders over $35 from this shop when you spend more than you planned to today
Handmade Ceramic Mug, Speckled Coffee Mug, Stoneware Cup
$28.00
A speckled stoneware mug, thrown by hand and glazed in matte white. Holds 12 oz.`);
    expect(p.price).toBe(28);
    expect(p.title).toBe("Handmade Ceramic Mug, Speckled Coffee Mug, Stoneware Cup");
  });

  it("leaves everything unknown for unrelated text", () => {
    const p = parseListingPaste("hello");
    expect(p.price).toBeNull();
    expect(p.description).toBeNull();
    expect(parseListingPaste("").found).toEqual([]);
  });
});
