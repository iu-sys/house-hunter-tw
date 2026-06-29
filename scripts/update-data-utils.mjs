export const DETAIL_FETCH_FAILURE_LABEL = "詳情頁讀取失敗";

const NON_RESIDENTIAL_SUITE_PATTERNS = [
  /\u4e0b\u55ae\u684c/u,
  /\u684c\u4f4d/u,
  /\u5ea7\u4f4d/u,
  /\u64cd\u76e4\u5ba4/u,
  /\u53ef\u8fa6\u516c/u,
  /\u8fa6\u516c\u5ba4/u,
  /\u5de5\u4f5c\u5ba4/u,
  /\u5171\u540c\u5de5\u4f5c/u,
  /\u5171\u4eab\u8fa6\u516c/u,
  /\u5546\u52d9\u7a7a\u9593/u,
];

export function hasNonResidentialSuiteText(text) {
  const normalizedText = typeof text === "string" ? text : "";
  return NON_RESIDENTIAL_SUITE_PATTERNS.some((pattern) => pattern.test(normalizedText));
}

export function shouldDropListingAfterStatusCode(listing, statusCode) {
  if (!listing || listing.source !== "591") return false;
  return [404, 410].includes(Number(statusCode));
}

export function shouldDropListingAfterDetailError(listing, error) {
  if (!listing || listing.source !== "591" || !error) return false;

  const message =
    typeof error === "string"
      ? error
      : [error.message, error.stderr, error.stdout].filter(Boolean).join("\n");

  return /requested url returned error:\s*(404|410)/i.test(message);
}

export function buildListingLookupUrl(listing) {
  if (!listing || typeof listing.url !== "string") return "";
  if (listing.source !== "591") return listing.url;

  const sourceUrl = listing.sourceUrl || listing.url;
  return sourceUrl;
}

export function normalizeListingForWrite(listing) {
  if (!listing) return listing;

  if (listing.source !== "591") {
    return {
      ...listing,
      sourceUrl: listing.sourceUrl || listing.url,
    };
  }

  return {
    ...listing,
    sourceUrl: listing.sourceUrl || listing.url,
    url: buildListingLookupUrl(listing),
  };
}

export function canReusePreviousListingDetails(currentListing, previousListing) {
  if (!currentListing || !previousListing) return false;
  if (currentListing.source !== "591" || previousListing.source !== "591") return false;
  if (currentListing.url !== previousListing.url) return false;

  const matchedConditions = Array.isArray(previousListing.matchedConditions)
    ? previousListing.matchedConditions
    : [];
  const missingConditions = Array.isArray(previousListing.missingConditions)
    ? previousListing.missingConditions
    : [];

  if (matchedConditions.length === 0 && missingConditions.length === 0) return false;
  if (missingConditions.includes(DETAIL_FETCH_FAILURE_LABEL)) return false;

  return true;
}

export function restorePreviousListingDetails(currentListing, previousListing) {
  return {
    ...currentListing,
    matchedConditions: [...previousListing.matchedConditions],
    missingConditions: [...previousListing.missingConditions],
    isMaleAllowed: previousListing.isMaleAllowed ?? true,
  };
}

export function getMaxListPage(urls) {
  const pageNumbers = (Array.isArray(urls) ? urls : [])
    .map((url) => {
      const href = typeof url === "string" ? url : "";
      return Number(href.match(/page=(\d+)/)?.[1] || 0);
    })
    .filter(Boolean);

  return pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;
}

export function prepareListingsForEnrichment(listings, previousListingsByUrl) {
  const readyListings = [];
  const listingsNeedingEnrichment = [];

  for (const listing of listings) {
    const previousListing =
      listing.source === "591" ? previousListingsByUrl.get(listing.url) : undefined;

    if (canReusePreviousListingDetails(listing, previousListing)) {
      readyListings.push(restorePreviousListingDetails(listing, previousListing));
      continue;
    }

    listingsNeedingEnrichment.push(listing);
  }

  return { readyListings, listingsNeedingEnrichment };
}

export function resolveListingWritePlan({
  nextListings,
  previousListings,
  minSafeListingCount,
}) {
  const freshListings = Array.isArray(nextListings) ? nextListings : [];
  const fallbackListings = Array.isArray(previousListings) ? previousListings : [];
  const minimumCount = Number(minSafeListingCount) || 0;

  if (freshListings.length >= minimumCount) {
    return {
      mode: "fresh",
      listings: freshListings,
      warning: "",
    };
  }

  if (fallbackListings.length >= minimumCount) {
    return {
      mode: "fallback",
      listings: fallbackListings,
      warning: `Only ${freshListings.length} fresh listings found; keeping previous ${fallbackListings.length} listings.`,
    };
  }

  throw new Error(
    `Refusing to write only ${freshListings.length} listings; expected at least ${minimumCount}.`,
  );
}
