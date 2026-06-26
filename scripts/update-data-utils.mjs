export const DETAIL_FETCH_FAILURE_LABEL = "詳情頁讀取失敗";

export function shouldDropListingAfterDetailError(listing, error) {
  if (!listing || listing.source !== "591" || !error) return false;

  const message =
    typeof error === "string"
      ? error
      : [error.message, error.stderr, error.stdout].filter(Boolean).join("\n");

  return /requested url returned error:\s*(404|406|410)/i.test(message);
}

export function buildListingLookupUrl(listing) {
  if (!listing || typeof listing.url !== "string") return "";
  if (listing.source !== "591") return listing.url;

  const sourceUrl = listing.sourceUrl || listing.url;
  const sourceId = String(sourceUrl).match(/rent\.591\.com\.tw\/(\d+)/)?.[1] || "";
  const keywords = String(listing.title || "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
  const query = ["site:rent.591.com.tw", sourceId, keywords].filter(Boolean).join(" ");
  const params = new URLSearchParams({ q: query });

  return `https://www.google.com/search?${params.toString()}`;
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
