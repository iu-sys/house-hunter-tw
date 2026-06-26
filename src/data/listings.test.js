import { describe, expect, it } from "vitest";
import { listings } from "./listings.js";

const targetDistricts = new Set([
  "永和區",
  "大同區",
  "中山區",
  "松山區",
  "大安區",
  "萬華區",
  "信義區",
  "士林區",
  "北投區",
  "內湖區",
  "南港區",
  "文山區",
  "板橋區",
  "三重區",
  "中和區",
  "新店區",
  "土城區",
  "中正區",
]);

describe("generated listing data", () => {
  it("does not collapse to a partial scrape", () => {
    expect(listings.length).toBeGreaterThanOrEqual(500);
  });

  it("keeps only target districts, allowed sources, and stable source links", () => {
    expect(listings.every((listing) => targetDistricts.has(listing.district))).toBe(true);
    expect(listings.every((listing) => ["591", "PTT"].includes(listing.source))).toBe(true);

    const invalid591SourceUrls = listings.filter(
      (listing) =>
        listing.source === "591" && !/rent\.591\.com\.tw\/\d+/.test(listing.sourceUrl || ""),
    );
    expect(invalid591SourceUrls).toEqual([]);

    const invalid591LookupUrls = listings.filter(
      (listing) =>
        listing.source === "591" &&
        !/^https:\/\/www\.google\.com\/search\?q=site%3Arent\.591\.com\.tw\+/.test(listing.url),
    );
    expect(invalid591LookupUrls).toEqual([]);
  });

  it("retains recent PTT suite listings alongside 591 data", () => {
    const pttListings = listings.filter((listing) => listing.source === "PTT");

    expect(pttListings.length).toBeGreaterThanOrEqual(0);
    expect(pttListings.every((listing) => listing.price && listing.price <= 15000)).toBe(true);
    expect(pttListings.every((listing) => targetDistricts.has(listing.district))).toBe(true);
  });

  it("excludes parking, warehouse, and storefront inventory", () => {
    const blockedPattern = /車位|停車|倉庫|店面/;

    expect(
      listings.filter((listing) => blockedPattern.test(`${listing.title} ${listing.url}`)),
    ).toEqual([]);
  });
});
