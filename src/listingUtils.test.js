import { describe, expect, it } from "vitest";
import { applyFilters, getStats, sortListings } from "./listingUtils.js";

const rows = [
  { id: "a", district: "中和區", price: 9500, title: "近捷運套房", source: "PTT", isNew: true },
  { id: "b", district: "板橋區", price: 8500, title: "江子翠套房", source: "591", isNew: true },
  { id: "c", district: "信義區", price: 15000, title: "安靜獨立套房", source: "591", isNew: false },
];

describe("listing utilities", () => {
  it("calculates totals, district counts, lowest listing, and new count", () => {
    expect(getStats(rows)).toEqual({
      total: 3,
      byDistrict: { "中和區": 1, "板橋區": 1, "信義區": 1 },
      lowest: rows[1],
      newCount: 2,
    });
  });

  it("filters by district, max price, source, new-only, and text query", () => {
    const filtered = applyFilters(rows, {
      districts: ["板橋區", "中和區"],
      maxPrice: 10000,
      sources: ["591"],
      onlyNew: true,
      query: "江子翠",
    });

    expect(filtered.map((row) => row.id)).toEqual(["b"]);
  });

  it("filters by minimum and maximum price together", () => {
    const filtered = applyFilters(rows, {
      districts: [],
      minPrice: 9000,
      maxPrice: 13000,
      sources: [],
      onlyNew: false,
      query: "",
    });

    expect(filtered.map((row) => row.id)).toEqual(["a"]);
  });

  it("sorts listings by newest first and price ascending", () => {
    expect(sortListings(rows, "price-asc").map((row) => row.id)).toEqual(["b", "a", "c"]);
    expect(sortListings(rows, "new-first").map((row) => row.id)).toEqual(["a", "b", "c"]);
  });
});
