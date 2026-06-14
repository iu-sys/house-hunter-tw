export const DETAIL_FETCH_FAILURE_LABEL = "詳情頁讀取失敗";

export function shouldDropListingAfterDetailError(listing, error) {
  if (!listing || listing.source !== "591" || !error) return false;

  const message =
    typeof error === "string"
      ? error
      : [error.message, error.stderr, error.stdout].filter(Boolean).join("\n");

  return /requested url returned error:\s*404/i.test(message);
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
  };
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
