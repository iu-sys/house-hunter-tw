import { describe, expect, it } from "vitest";
import {
  buildListingLookupUrl,
  DETAIL_FETCH_FAILURE_LABEL,
  canReusePreviousListingDetails,
  getMaxListPage,
  hasSingleOccupantRestrictionText,
  hasNonResidentialSuiteText,
  normalizeListingForWrite,
  prepareListingsForEnrichment,
  resolveListingWritePlan,
  shouldDropListingAfterStatusCode,
  shouldDropListingAfterDetailError,
} from "./update-data-utils.mjs";

const baseListing = {
  source: "591",
  district: "\u4e2d\u548c\u5340",
  price: 12000,
  title: "\u6377\u904b\u65c1\u5957\u623f",
  area: "6\u576a",
  metro: "\u666f\u5b89",
  url: "https://rent.591.com.tw/123456",
};

describe("update-data utils", () => {
  it("reuses previous 591 detail matches for unchanged listings", () => {
    const previousListing = {
      ...baseListing,
      matchedConditions: ["\u5c0d\u5916\u7a97", "\u6377\u904b10\u5206\u5167"],
      missingConditions: ["711\u8d70\u8def2\u5206\u9418\u5167"],
      searchText: "\u96fb\u8cbb\u4e00\u5ea66\u584a",
      isMaleAllowed: true,
    };

    expect(canReusePreviousListingDetails(baseListing, previousListing)).toBe(true);

    const { readyListings, listingsNeedingEnrichment } = prepareListingsForEnrichment(
      [baseListing],
      new Map([[baseListing.url, previousListing]]),
    );

    expect(listingsNeedingEnrichment).toEqual([]);
    expect(readyListings).toEqual([
      {
        ...baseListing,
        matchedConditions: ["\u5c0d\u5916\u7a97", "\u6377\u904b10\u5206\u5167"],
        missingConditions: ["711\u8d70\u8def2\u5206\u9418\u5167"],
        searchText: "\u96fb\u8cbb\u4e00\u5ea66\u584a",
        isMaleAllowed: true,
      },
    ]);
  });

  it("refetches previous 591 detail matches when hidden search text is missing", () => {
    const previousListing = {
      ...baseListing,
      matchedConditions: ["\u5c0d\u5916\u7a97"],
      missingConditions: [],
      isMaleAllowed: true,
    };

    expect(canReusePreviousListingDetails(baseListing, previousListing)).toBe(false);

    const { readyListings, listingsNeedingEnrichment } = prepareListingsForEnrichment(
      [baseListing],
      new Map([[baseListing.url, previousListing]]),
    );

    expect(readyListings).toEqual([]);
    expect(listingsNeedingEnrichment).toEqual([baseListing]);
  });

  it("reuses previous details even if summary fields changed, but refetches prior failures", () => {
    const changedPrice = { ...baseListing, price: 13000 };
    const failedCurrentListing = {
      ...baseListing,
      url: "https://rent.591.com.tw/654321",
    };
    const previousListing = {
      ...baseListing,
      matchedConditions: ["\u5c0d\u5916\u7a97"],
      missingConditions: [],
      searchText: "\u96fb\u8cbb\u4e00\u5ea66\u584a",
      isMaleAllowed: true,
    };
    const previousFailedListing = {
      ...failedCurrentListing,
      matchedConditions: ["\u5c0d\u5916\u7a97"],
      missingConditions: [DETAIL_FETCH_FAILURE_LABEL],
    };

    expect(canReusePreviousListingDetails(changedPrice, previousListing)).toBe(true);
    expect(canReusePreviousListingDetails(failedCurrentListing, previousFailedListing)).toBe(false);

    const { readyListings, listingsNeedingEnrichment } = prepareListingsForEnrichment(
      [changedPrice, failedCurrentListing],
      new Map([
        [changedPrice.url, previousListing],
        [failedCurrentListing.url, previousFailedListing],
      ]),
    );

    expect(readyListings).toEqual([
      {
        ...changedPrice,
        matchedConditions: ["\u5c0d\u5916\u7a97"],
        missingConditions: [],
        searchText: "\u96fb\u8cbb\u4e00\u5ea66\u584a",
        isMaleAllowed: true,
      },
    ]);
    expect(listingsNeedingEnrichment).toEqual([failedCurrentListing]);
  });

  it("drops 591 listings when detail fetch confirms the page is gone", () => {
    const curl404Error = new Error("curl: (22) The requested URL returned error: 404");
    const curl406Error = new Error("curl: (22) The requested URL returned error: 406");

    expect(shouldDropListingAfterDetailError(baseListing, curl404Error)).toBe(true);
    expect(shouldDropListingAfterDetailError(baseListing, curl406Error)).toBe(false);
    expect(shouldDropListingAfterDetailError(baseListing, new Error("operation timed out"))).toBe(
      false,
    );
    expect(
      shouldDropListingAfterDetailError({ ...baseListing, source: "PTT" }, curl404Error),
    ).toBe(false);
  });

  it("drops reused 591 listings when a lightweight status check returns 404 or 410", () => {
    expect(shouldDropListingAfterStatusCode(baseListing, 404)).toBe(true);
    expect(shouldDropListingAfterStatusCode(baseListing, 410)).toBe(true);
    expect(shouldDropListingAfterStatusCode(baseListing, 406)).toBe(false);
    expect(shouldDropListingAfterStatusCode(baseListing, 200)).toBe(false);
    expect(shouldDropListingAfterStatusCode({ ...baseListing, source: "PTT" }, 404)).toBe(false);
  });

  it("detects office or desk listings that are not residential suites", () => {
    expect(
      hasNonResidentialSuiteText(
        "\u81ea\u79df\u5c08\u8077\u6295\u8cc7\u4eba\u97ed\u83dc\u80a1\u7968\u4e0b\u55ae\u684c\u64cd\u76e4\u5ba4",
      ),
    ).toBe(true);
    expect(hasNonResidentialSuiteText("\u4e00\u6a13\u65b0\u6574\u7406\u53ef\u5de5\u4f5c\u5ba4")).toBe(
      true,
    );
    expect(hasNonResidentialSuiteText("\u7368\u7acb\u5957\u623f\u53ef\u8fa6\u516c\u5ba4")).toBe(
      true,
    );

    expect(hasNonResidentialSuiteText("\u65b0\u5e97\u6377\u904b\u7ad9\u7368\u7acb\u5957\u623f")).toBe(
      false,
    );
  });

  it("detects single-occupant restrictions in listing text", () => {
    expect(hasSingleOccupantRestrictionText("限有正職一人住，租賃契約需經公證")).toBe(true);
    expect(hasSingleOccupantRestrictionText("三重簡約套房出租，適合單人")).toBe(true);
    expect(hasSingleOccupantRestrictionText("近捷運，低樓層，限單身，飲水機")).toBe(true);

    expect(hasSingleOccupantRestrictionText("單人床獨立套房，男女皆可租住")).toBe(false);
    expect(hasSingleOccupantRestrictionText("小資族最愛，男女皆可租住")).toBe(false);
  });

  it("keeps the original 591 source URL for click-through links", () => {
    expect(
      buildListingLookupUrl({
        ...baseListing,
        district: "三重區",
        title: "【可寵可租補】三重集美街精緻套房/有垃圾代收/免追垃圾車",
      }),
    ).toBe("https://rent.591.com.tw/123456");
  });

  it("keeps PTT links unchanged because article URLs are already canonical", () => {
    expect(
      buildListingLookupUrl({
        source: "PTT",
        url: "https://www.ptt.cc/bbs/Rent_tao/M.1782445812.A.1B5.html",
      }),
    ).toBe("https://www.ptt.cc/bbs/Rent_tao/M.1782445812.A.1B5.html");
  });

  it("normalizes fallback 591 listings to keep sourceUrl and original click URLs", () => {
    expect(
      normalizeListingForWrite({
        ...baseListing,
        district: "中和區",
        title: "景安站採光套房",
      }),
    ).toEqual({
      ...baseListing,
      district: "中和區",
      title: "景安站採光套房",
      sourceUrl: "https://rent.591.com.tw/123456",
      url: "https://rent.591.com.tw/123456",
    });
  });

  it("detects the real last 591 list page from pagination links", () => {
    expect(
      getMaxListPage([
        "/list?region=1&kind=2,3&rentprice=0,15000&page=1",
        "/list?region=1&kind=2,3&rentprice=0,15000&page=2",
        "/list?region=1&kind=2,3&rentprice=0,15000&page=6",
        "/list?region=1&kind=2,3&rentprice=0,15000&page=32",
      ]),
    ).toBe(32);
    expect(getMaxListPage([])).toBe(1);
  });

  it("writes fresh listings when the scrape returns a safe count", () => {
    const nextListings = Array.from({ length: 500 }, (_, index) => ({
      ...baseListing,
      url: `https://rent.591.com.tw/${200000 + index}`,
    }));
    const previousListings = Array.from({ length: 700 }, (_, index) => ({
      ...baseListing,
      url: `https://rent.591.com.tw/${300000 + index}`,
    }));

    expect(
      resolveListingWritePlan({
        nextListings,
        previousListings,
        minSafeListingCount: 500,
      }),
    ).toEqual({
      mode: "fresh",
      listings: nextListings,
      warning: "",
    });
  });

  it("falls back to previous listings when the new scrape is too small", () => {
    const nextListings = [{ ...baseListing }];
    const previousListings = Array.from({ length: 600 }, (_, index) => ({
      ...baseListing,
      url: `https://rent.591.com.tw/${400000 + index}`,
    }));

    expect(
      resolveListingWritePlan({
        nextListings,
        previousListings,
        minSafeListingCount: 500,
      }),
    ).toEqual({
      mode: "fallback",
      listings: previousListings,
      warning: "Only 1 fresh listings found; keeping previous 600 listings.",
    });
  });
});
