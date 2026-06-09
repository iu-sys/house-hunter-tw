import { describe, expect, it } from "vitest";
import { listings } from "./listings.js";

const targetDistricts = new Set([
  "中正區",
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
  "永和區",
  "新店區",
  "土城區",
]);

describe("generated listing data", () => {
  it("does not collapse to a partial scrape", () => {
    expect(listings.length).toBeGreaterThanOrEqual(500);
  });

  it("keeps only target districts and direct 591 listing URLs", () => {
    expect(listings.every((listing) => targetDistricts.has(listing.district))).toBe(true);

    const invalid591Urls = listings.filter(
      (listing) => listing.source === "591" && !/rent\.591\.com\.tw\/\d+/.test(listing.url),
    );
    expect(invalid591Urls).toEqual([]);
  });
});
