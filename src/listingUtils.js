export function getStats(listings) {
  const byDistrict = listings.reduce((counts, listing) => {
    counts[listing.district] = (counts[listing.district] || 0) + 1;
    return counts;
  }, {});

  const lowest = listings.reduce((winner, listing) => {
    if (!listing.price) return winner;
    if (!winner || listing.price < winner.price) return listing;
    return winner;
  }, null);

  return {
    total: listings.length,
    byDistrict,
    lowest,
    newCount: listings.filter((listing) => listing.isNew).length,
  };
}

export function applyFilters(listings, filters) {
  const query = filters.query.trim().toLocaleLowerCase("zh-Hant");

  return listings.filter((listing) => {
    const districtMatch =
      filters.districts.length === 0 || filters.districts.includes(listing.district);
    const sourceMatch = filters.sources.length === 0 || filters.sources.includes(listing.source);
    const minPriceMatch = !filters.minPrice || listing.price >= filters.minPrice;
    const maxPriceMatch = !filters.maxPrice || listing.price <= filters.maxPrice;
    const newMatch = !filters.onlyNew || listing.isNew;
    const text = `${listing.district} ${listing.title} ${listing.area} ${listing.metro} ${listing.source} ${listing.searchText || ""}`;
    const queryMatch = !query || text.toLocaleLowerCase("zh-Hant").includes(query);

    return districtMatch && sourceMatch && minPriceMatch && maxPriceMatch && newMatch && queryMatch;
  });
}

export function sortListings(listings, sortKey) {
  return [...listings].sort((a, b) => {
    if (sortKey === "condition-fit") {
      if ((a.conditionScore || 0) !== (b.conditionScore || 0)) {
        return (b.conditionScore || 0) - (a.conditionScore || 0);
      }
      return a.price - b.price;
    }
    if (sortKey === "price-desc") return b.price - a.price;
    if (sortKey === "district") return a.district.localeCompare(b.district, "zh-Hant");
    if (sortKey === "new-first") {
      if (a.isNew !== b.isNew) return Number(b.isNew) - Number(a.isNew);
      return 0;
    }

    return a.price - b.price;
  });
}

export function formatDistrictSummary(byDistrict) {
  return Object.entries(byDistrict)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hant"))
    .map(([district, count]) => `${district} ${count}`)
    .join("、");
}
