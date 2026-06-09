export const defaultCustomRule = {
  label: "",
  type: "include",
  mode: "bonus",
  value: "",
};

export function parseKeywords(value) {
  return String(value || "")
    .split(/[,\n，、\s]+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

export function buildListingText(listing) {
  return [
    listing.district,
    listing.priceText,
    listing.title,
    listing.area,
    listing.metro,
    listing.source,
    ...(listing.matchedConditions || []),
    ...(listing.missingConditions || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("zh-Hant");
}

export function normalizeCustomRules(rules) {
  return (Array.isArray(rules) ? rules : [])
    .map((rule, index) => ({
      id: rule.id || `custom-${index}`,
      label: String(rule.label || "").trim(),
      type: rule.type === "exclude" ? "exclude" : "include",
      mode: rule.mode === "required" ? "required" : "bonus",
      value: String(rule.value || "").trim(),
      enabled: rule.enabled !== false,
    }))
    .filter((rule) => rule.enabled && rule.label && parseKeywords(rule.value).length > 0);
}

function ruleMatchesText(rule, text) {
  const keywords = parseKeywords(rule.value).map((keyword) => keyword.toLocaleLowerCase("zh-Hant"));
  const hasKeyword = keywords.some((keyword) => text.includes(keyword));
  return rule.type === "exclude" ? !hasKeyword : hasKeyword;
}

export function applyCustomConditions(listings, rules) {
  const normalizedRules = normalizeCustomRules(rules);
  if (normalizedRules.length === 0) {
    return listings.map((listing) => ({
      ...listing,
      customMatchedConditions: [],
      customMissingConditions: [],
      customConditionScore: 0,
    }));
  }

  return listings
    .map((listing) => {
      const text = buildListingText(listing);
      const customMatchedConditions = [];
      const customMissingConditions = [];

      for (const rule of normalizedRules) {
        const matched = ruleMatchesText(rule, text);
        if (matched) {
          customMatchedConditions.push(rule.label);
        } else {
          customMissingConditions.push(rule.label);
        }
      }

      const baseScore = listing.conditionScore ?? (listing.matchedConditions || []).length;

      return {
        ...listing,
        matchedConditions: [...(listing.matchedConditions || []), ...customMatchedConditions],
        missingConditions: [...(listing.missingConditions || []), ...customMissingConditions],
        customMatchedConditions,
        customMissingConditions,
        customConditionScore: customMatchedConditions.length,
        conditionScore: baseScore + customMatchedConditions.length,
      };
    })
    .filter((listing) =>
      normalizedRules.every(
        (rule) => rule.mode !== "required" || listing.customMatchedConditions.includes(rule.label),
      ),
    );
}
