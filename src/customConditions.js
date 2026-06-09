export const defaultCustomRule = {
  label: "",
  type: "include",
  mode: "bonus",
  value: "",
  enabled: true,
};

export const baseConditionLabels = [
  "對外窗",
  "捷運10分內",
  "有網路",
  "衣櫃",
  "有租補",
  "台水台電或電費5元內",
  "711走路2分鐘內",
  "冰箱",
  "電視",
];

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

export function normalizeBaseConditions(activeBaseConditions = baseConditionLabels) {
  const activeLabels = Array.isArray(activeBaseConditions)
    ? activeBaseConditions
    : baseConditionLabels;
  const knownLabels = new Set(baseConditionLabels);

  return activeLabels.filter((label) => knownLabels.has(label));
}

function ruleMatchesText(rule, text) {
  const keywords = parseKeywords(rule.value).map((keyword) => keyword.toLocaleLowerCase("zh-Hant"));
  const hasKeyword = keywords.some((keyword) => text.includes(keyword));
  return rule.type === "exclude" ? !hasKeyword : hasKeyword;
}

export function applyCustomConditions(listings, rules, options = {}) {
  const activeBaseSet = new Set(normalizeBaseConditions(options.activeBaseConditions));
  const normalizedRules = normalizeCustomRules(rules);

  return listings
    .map((listing) => {
      const text = buildListingText(listing);
      const baseMatchedConditions = (listing.matchedConditions || []).filter((condition) =>
        activeBaseSet.has(condition),
      );
      const baseMissingConditions = (listing.missingConditions || []).filter((condition) =>
        activeBaseSet.has(condition),
      );
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

      return {
        ...listing,
        matchedConditions: [...baseMatchedConditions, ...customMatchedConditions],
        missingConditions: [...baseMissingConditions, ...customMissingConditions],
        customMatchedConditions,
        customMissingConditions,
        customConditionScore: customMatchedConditions.length,
        conditionScore: baseMatchedConditions.length + customMatchedConditions.length,
      };
    })
    .filter((listing) =>
      normalizedRules.every(
        (rule) => rule.mode !== "required" || listing.customMatchedConditions.includes(rule.label),
      ),
    );
}
