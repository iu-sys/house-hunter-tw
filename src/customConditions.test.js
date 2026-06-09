import { describe, expect, it } from "vitest";
import { applyCustomConditions, buildListingText, parseKeywords } from "./customConditions.js";

const listing = {
  id: "home-1",
  district: "中和區",
  priceText: "12,000元/月",
  title: "可貓垃圾代收獨洗套房",
  area: "6坪",
  metro: "景安",
  source: "591",
  matchedConditions: ["有網路", "冰箱"],
  missingConditions: ["有租補"],
};

describe("custom conditions", () => {
  it("parses comma and whitespace separated keywords", () => {
    expect(parseKeywords("可貓, 垃圾代收 獨洗")).toEqual(["可貓", "垃圾代收", "獨洗"]);
  });

  it("builds searchable text from visible listing fields and condition labels", () => {
    expect(buildListingText(listing)).toContain("可貓垃圾代收獨洗套房");
    expect(buildListingText(listing)).toContain("有網路");
    expect(buildListingText(listing)).toContain("有租補");
  });

  it("filters required include and exclude rules, then adds bonus matches", () => {
    const result = applyCustomConditions([listing], [
      { id: "a", label: "要可貓", type: "include", mode: "required", value: "可貓" },
      { id: "b", label: "不要頂加", type: "exclude", mode: "required", value: "頂加" },
      { id: "c", label: "垃圾代收", type: "include", mode: "bonus", value: "垃圾代收" },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].customMatchedConditions).toEqual(["要可貓", "不要頂加", "垃圾代收"]);
    expect(result[0].customConditionScore).toBe(3);
    expect(result[0].conditionScore).toBe(5);
  });

  it("removes listings that fail required custom rules", () => {
    expect(
      applyCustomConditions([listing], [
        { id: "a", label: "不要垃圾代收", type: "exclude", mode: "required", value: "垃圾代收" },
      ]),
    ).toEqual([]);
  });
});
