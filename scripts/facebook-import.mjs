import fs from "node:fs/promises";

export const FACEBOOK_SOURCE = "Facebook";

export async function loadFacebookListings(filePath, options) {
  let raw = [];

  try {
    raw = JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  return normalizeFacebookListings(raw, options);
}

export function normalizeFacebookListings(rawListings, options) {
  if (!Array.isArray(rawListings)) return [];

  return rawListings
    .map((item, index) => normalizeFacebookListing(item, index, options))
    .filter(Boolean);
}

function normalizeFacebookListing(item, index, options) {
  const title = cleanText(item.title || firstSentence(item.text) || `Facebook 房源 ${index + 1}`);
  const text = cleanText(item.text || item.content || "");
  const fullText = cleanText(`${title} ${text}`);
  const district = cleanText(item.district) || findDistrict(fullText, options.targetDistricts);
  const price = Number(item.price) || extractPrice(fullText);
  const area = cleanText(item.area) || fullText.match(/(\d+(?:\.\d+)?)\s*坪/)?.[0] || "";
  const metro = cleanText(item.metro) || extractMetro(fullText);
  const url = cleanText(item.url);

  if (!url || !title || !district || !price || price > 15000) return null;
  if (options.blockedText.some((blocked) => fullText.includes(blocked))) return null;
  if (options.femaleOnlyPatterns.some((pattern) => pattern.test(fullText))) return null;

  return {
    source: FACEBOOK_SOURCE,
    district,
    price,
    priceText: `${price.toLocaleString("zh-TW")}元/月`,
    title,
    area,
    metro,
    url,
    isNew: item.isNew ?? isRecentDate(item.postedAt, 3),
    text: fullText,
    detailText: text,
    fullText,
    matchedConditions: options.matchedRequiredConditions(fullText),
    missingConditions: options.missingRequiredConditions(fullText),
    isMaleAllowed: true,
  };
}

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function firstSentence(text = "") {
  return cleanText(text).split(/[。！？\n]/)[0] || "";
}

function findDistrict(text, targetDistricts) {
  return targetDistricts.find((district) => text.includes(district)) || "";
}

function extractPrice(text) {
  const patterns = [
    /(?:租金|月租|價格|租[:：]?)[^\d]{0,30}([\d,]{4,6})/i,
    /([\d,]{4,6})\s*(?:元\/月|元\s*\/\s*月|元|\/月)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1].replace(/,/g, ""));
  }

  return 0;
}

function extractMetro(text) {
  const metroMatch =
    text.match(/(?:近|距)\s*([^，,。；;\s]{1,8}?)(?:捷運站|站)/) ||
    text.match(/(?:近|距|捷運站|捷運)\s*([^，,。；;\s]{1,12})(?:站|捷運)?/) ||
    text.match(/([^，,。；;\s]{1,12})(?:捷運站|站)\s*(?:步行|走路|徒歩)?/);
  return metroMatch?.[1] || "";
}

function isRecentDate(value, days) {
  if (!value) return true;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}
