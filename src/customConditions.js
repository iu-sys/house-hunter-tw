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

const keywordAliases = [
  ["頂加", "頂樓加蓋", "頂樓加建", "頂樓增建"],
  [
    "一度6塊",
    "一度6元",
    "一度6",
    "每度6",
    "每度6元",
    "電6",
    "電6元",
    "電費6",
    "電費6元",
    "電一度6塊",
    "電一度6元",
    "電費一度6塊",
    "電費一度6元",
    "電每度6塊",
    "電每度6元",
    "電費每度6塊",
    "電費每度6元",
    "6塊",
    "6元/度",
    "6元一度",
    "六塊",
    "六元",
  ],
];

export function parseKeywords(value) {
  return String(value || "")
    .split(/[,\n，、\s]+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function expandKeywordAliases(keywords) {
  const expanded = new Set(keywords);

  for (const keyword of keywords) {
    for (const aliases of keywordAliases) {
      if (aliases.includes(keyword)) {
        aliases.forEach((alias) => expanded.add(alias));
      }
    }
  }

  return [...expanded];
}

function normalizeComparableText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/ㄧ/g, "一")
    .toLocaleLowerCase("zh-Hant")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function isElectricityRateKeyword(keyword) {
  const normalized = normalizeComparableText(keyword);
  return /[6六]/.test(normalized) && /(度|塊|元)/.test(normalized);
}

function removeBroadElectricityKeywords(keywords) {
  if (!keywords.some(isElectricityRateKeyword)) return keywords;

  return keywords.filter((keyword) => !["電", "電費"].includes(normalizeComparableText(keyword)));
}

export function buildListingText(listing) {
  return [
    listing.district,
    listing.priceText,
    listing.title,
    listing.area,
    listing.metro,
    listing.source,
    listing.searchText,
    ...(listing.matchedConditions || []),
    ...(listing.missingConditions || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("zh-Hant");
}

export function normalizeCustomRules(rules) {
  return (Array.isArray(rules) ? rules : [])
    .map((rule, index) => {
      const label = String(rule.label || "").trim();
      const value = String(rule.value || "").trim() || label;

      return {
        id: rule.id || `custom-${index}`,
        label,
        type: rule.type === "exclude" ? "exclude" : "include",
        mode: rule.mode === "required" ? "required" : "bonus",
        value,
        enabled: rule.enabled !== false,
      };
    })
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
  const keywords = expandKeywordAliases(removeBroadElectricityKeywords(parseKeywords(rule.value)))
    .map((keyword) => keyword.toLocaleLowerCase("zh-Hant"));
  const compactText = normalizeComparableText(text);
  const hasKeyword = keywords.some((keyword) => {
    const compactKeyword = normalizeComparableText(keyword);
    return text.includes(keyword) || (compactKeyword && compactText.includes(compactKeyword));
  });
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
      const passedRequiredRuleLabels = [];

      for (const rule of normalizedRules) {
        const matched = ruleMatchesText(rule, text);
        if (matched) {
          passedRequiredRuleLabels.push(rule.label);
          if (rule.type !== "exclude") {
            customMatchedConditions.push(rule.label);
          }
        } else if (rule.type !== "exclude") {
          customMissingConditions.push(rule.label);
        }
      }

      return {
        ...listing,
        matchedConditions: [...baseMatchedConditions, ...customMatchedConditions],
        missingConditions: [...baseMissingConditions, ...customMissingConditions],
        customMatchedConditions,
        customMissingConditions,
        passedRequiredRuleLabels,
        customConditionScore: customMatchedConditions.length,
        conditionScore: baseMatchedConditions.length + customMatchedConditions.length,
      };
    })
    .filter((listing) =>
      normalizedRules.every(
        (rule) => rule.mode !== "required" || listing.passedRequiredRuleLabels.includes(rule.label),
      ),
    )
    .map(({ passedRequiredRuleLabels, ...listing }) => listing);
}
