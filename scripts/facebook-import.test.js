import { describe, expect, it } from "vitest";
import { normalizeFacebookListings } from "./facebook-import.mjs";

const options = {
  targetDistricts: ["中和區", "板橋區"],
  blockedText: ["雅房", "已出租"],
  femaleOnlyPatterns: [/限\s*女/],
  matchedRequiredConditions: (text) => (text.includes("對外窗") ? ["對外窗"] : []),
  missingRequiredConditions: (text) => (text.includes("對外窗") ? [] : ["對外窗"]),
};

describe("Facebook listing import", () => {
  it("normalizes usable Facebook posts into rental listings", () => {
    const listings = normalizeFacebookListings(
      [
        {
          text: "中和區近景安捷運站，獨立套房 6坪，月租 12,000元/月，有對外窗可租補，男性可入住",
          url: "https://www.facebook.com/groups/rent/posts/123",
          postedAt: "2026-06-10",
        },
      ],
      options,
    );

    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      source: "Facebook",
      district: "中和區",
      price: 12000,
      priceText: "12,000元/月",
      area: "6坪",
      metro: "景安",
      matchedConditions: ["對外窗"],
    });
  });

  it("filters blocked, over-budget, and female-only Facebook posts", () => {
    const listings = normalizeFacebookListings(
      [
        { text: "板橋區雅房 8000元", url: "https://www.facebook.com/groups/rent/posts/a" },
        { text: "板橋區套房 18000元", url: "https://www.facebook.com/groups/rent/posts/b" },
        { text: "中和區套房 12000元 限女", url: "https://www.facebook.com/groups/rent/posts/c" },
      ],
      options,
    );

    expect(listings).toEqual([]);
  });
});
