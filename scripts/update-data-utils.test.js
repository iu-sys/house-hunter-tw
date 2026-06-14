import { describe, expect, it } from "vitest";
import {
  DETAIL_FETCH_FAILURE_LABEL,
  canReusePreviousListingDetails,
  shouldDropListingAfterDetailError,
  prepareListingsForEnrichment,
} from "./update-data-utils.mjs";

const baseListing = {
  source: "591",
  district: "中和區",
  price: 12000,
  title: "近捷運套房",
  area: "6坪",
  metro: "景安",
  url: "https://rent.591.com.tw/123456",
};

describe("update-data utils", () => {
  it("reuses previous 591 detail matches for unchanged listings", () => {
    const previousListing = {
      ...baseListing,
      matchedConditions: ["對外窗", "捷運10分內"],
      missingConditions: ["711走路2分鐘內"],
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
        matchedConditions: ["對外窗", "捷運10分內"],
        missingConditions: ["711走路2分鐘內"],
      },
    ]);
  });

  it("reuses previous details even if summary fields changed, but refetches prior failures", () => {
    const changedPrice = { ...baseListing, price: 13000 };
    const failedCurrentListing = {
      ...baseListing,
      url: "https://rent.591.com.tw/654321",
    };
    const previousListing = {
      ...baseListing,
      matchedConditions: ["對外窗"],
      missingConditions: [],
    };
    const previousFailedListing = {
      ...failedCurrentListing,
      matchedConditions: ["對外窗"],
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
        matchedConditions: ["對外窗"],
        missingConditions: [],
      },
    ]);
    expect(listingsNeedingEnrichment).toEqual([failedCurrentListing]);
  });

  it("drops 591 listings when detail fetch confirms the page is gone", () => {
    const curl404Error = new Error("curl: (22) The requested URL returned error: 404");

    expect(shouldDropListingAfterDetailError(baseListing, curl404Error)).toBe(true);
    expect(shouldDropListingAfterDetailError(baseListing, new Error("operation timed out"))).toBe(
      false,
    );
    expect(
      shouldDropListingAfterDetailError({ ...baseListing, source: "PTT" }, curl404Error),
    ).toBe(false);
  });
});
