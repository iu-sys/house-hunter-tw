import fs from "node:fs/promises";
import { JSDOM } from "jsdom";

const TARGET_DISTRICTS = [
  "中正區",
  "大同區",
  "中山區",
  "松山區",
  "大安區",
  "萬華區",
  "信義區",
  "士林區",
  "北投區",
  "內湖區",
  "南港區",
  "文山區",
  "板橋區",
  "三重區",
  "中和區",
  "永和區",
  "新店區",
  "土城區",
];

const REGIONS = [
  { id: 1, rows: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300] },
  { id: 3, rows: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300] },
];

const BLOCKED_TEXT = [
  "限女性",
  "限女",
  "限單人",
  "限一人",
  "只限單人",
  "限1人",
  "單人入住",
  "已出租",
  "雅房",
  "車位",
  "停車",
  "倉庫",
  "店面",
];

const FEMALE_ONLY_PATTERNS = [
  /限\s*女/,
  /限\s*女性/,
  /限\s*女生/,
  /只租\s*女/,
  /僅限\s*女/,
  /女生限定/,
  /女性限定/,
  /女生套房/,
  /女性套房/,
  /單人女性/,
];

const REQUIRED_CONDITIONS = [
  { label: "格局方正", test: (text) => text.includes("格局方正") },
  { label: "對外窗", test: (text) => text.includes("對外窗") },
  { label: "捷運10分內", test: (text) => isMetroWithinTenMinutes(text) },
  { label: "有網路", test: (text) => /網路|寬頻|Wi-?Fi|wifi/i.test(text) },
  { label: "衣櫃", test: (text) => /衣櫃|衣柜/.test(text) },
  { label: "禁菸房", test: (text) => /禁菸|禁煙|不可抽菸|不能抽菸|不抽菸|禁抽菸/.test(text) },
  { label: "有租補", test: (text) => /租補|租屋補助|可申請補助|補助/.test(text) },
  { label: "台水台電或電費5元內", test: (text) => hasAcceptableUtilityRate(text) },
  { label: "附近有711", test: (text) => /7-11|711|便利商店|超商/.test(text) },
  { label: "冰箱", test: (text) => text.includes("冰箱") },
  { label: "電視", test: (text) => text.includes("電視") },
];

const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function buildUrl(region, firstRow) {
  const params = new URLSearchParams({
    region: String(region),
    kind: "2,3",
    order: "posttime",
    orderType: "desc",
    firstRow: String(firstRow),
  });
  return `https://rent.591.com.tw/list?${params.toString()}`;
}

async function fetchListPage(region, firstRow) {
  const url = buildUrl(region, firstRow);
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: "https://rent.591.com.tw/",
      "User-Agent": userAgent,
    },
  });

  if (!response.ok) {
    throw new Error(`591 list request failed: ${response.status} ${url}`);
  }

  return response.text();
}

async function fetchDetailPage(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: "https://rent.591.com.tw/list?region=1&kind=2,3",
      "User-Agent": userAgent,
    },
  });

  if (!response.ok) {
    throw new Error(`591 detail request failed: ${response.status} ${url}`);
  }

  return response.text();
}

function isMetroWithinTenMinutes(text) {
  const distanceMatches = [...text.matchAll(/距[^0-9\s]{1,20}\s*(\d{2,4})\s*公尺/g)];
  if (distanceMatches.some((match) => Number(match[1]) <= 800)) return true;

  return (
    /捷運.{0,15}(10分|十分|10分鐘|[1-9]分|[1-9]分鐘)/.test(text) ||
    /(10分|十分|10分鐘|[1-9]分|[1-9]分鐘).{0,15}捷運/.test(text)
  );
}

function hasAcceptableUtilityRate(text) {
  if (/台水台電|台電台水/.test(text)) return true;
  if (text.includes("台水") && text.includes("台電")) return true;

  const utilityPatterns = [
    /電費.{0,12}([1-5](?:\.\d+)?)\s*元/,
    /([1-5](?:\.\d+)?)\s*元\s*\/?\s*度/,
    /一度.{0,8}([1-5](?:\.\d+)?)/,
    /每度.{0,8}([1-5](?:\.\d+)?)/,
  ];

  return utilityPatterns.some((pattern) => pattern.test(text));
}

function parseListing(item) {
  const text = item.textContent.replace(/\s+/g, " ").trim();
  const link = item.querySelector(".item-info-title a");
  const title = link?.getAttribute("title")?.trim() || link?.textContent.trim() || "";
  const id = item.getAttribute("data-id") || "";
  const price = Number(
    item.querySelector(".item-info-price strong")?.textContent.replace(/[^\d]/g, "") || 0,
  );
  const district = TARGET_DISTRICTS.find((candidate) => text.includes(candidate)) || "";
  const area = text.match(/(\d+(?:\.\d+)?)坪/)?.[0] || "";
  const metro = text.match(/距([^0-9\s]+)\d+\s*公尺/)?.[1] || "";
  const sourceUrl = link?.href || (id ? `https://rent.591.com.tw/${id}` : "");
  const isNew = text.includes("新上架");

  return {
    source: "591",
    district,
    price,
    priceText: price ? `${price.toLocaleString("zh-TW")}元/月` : "",
    title,
    area,
    metro,
    url: sourceUrl,
    isNew,
    text,
  };
}

function shouldKeep(listing) {
  if (!listing.url || !listing.title || !listing.district) return false;
  if (!listing.price || listing.price > 15000) return false;
  if (BLOCKED_TEXT.some((blocked) => `${listing.title} ${listing.text}`.includes(blocked))) {
    return false;
  }
  return true;
}

function missingRequiredConditions(text) {
  return REQUIRED_CONDITIONS.filter((condition) => !condition.test(text)).map(
    (condition) => condition.label,
  );
}

function matchedRequiredConditions(text) {
  return REQUIRED_CONDITIONS.filter((condition) => condition.test(text)).map(
    (condition) => condition.label,
  );
}

async function enrichListing(listing) {
  try {
    const html = await fetchDetailPage(listing.url);
    const document = new JSDOM(html).window.document;
    const detailText = document.body.textContent.replace(/\s+/g, " ").trim();
    const fullText = `${listing.title} ${listing.text} ${detailText}`;
    const matchedConditions = matchedRequiredConditions(fullText);
    return {
      ...listing,
      detailText,
      fullText,
      matchedConditions,
      missingConditions: missingRequiredConditions(fullText),
      isMaleAllowed: !FEMALE_ONLY_PATTERNS.some((pattern) => pattern.test(fullText)),
    };
  } catch (error) {
    const fullText = `${listing.title} ${listing.text}`;
    const matchedConditions = matchedRequiredConditions(fullText);
    return {
      ...listing,
      detailText: "",
      fullText,
      matchedConditions,
      missingConditions: [...missingRequiredConditions(fullText), "詳情頁讀取失敗"],
      isMaleAllowed: !FEMALE_ONLY_PATTERNS.some((pattern) => pattern.test(fullText)),
      detailError: error.message,
    };
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function serializeListings(listings) {
  const rows = listings
    .map((listing) =>
      JSON.stringify([
        listing.source,
        listing.district,
        listing.price,
        listing.priceText,
        listing.title,
        listing.area,
        listing.metro,
        listing.url,
        listing.isNew,
        listing.matchedConditions,
        listing.missingConditions,
      ]),
    )
    .join(",\n  ");

  const taipeiNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const pad = (value) => String(value).padStart(2, "0");
  const updatedAt = `${taipeiNow.getFullYear()}-${pad(taipeiNow.getMonth() + 1)}-${pad(
    taipeiNow.getDate(),
  )} ${pad(taipeiNow.getHours())}:${pad(taipeiNow.getMinutes())}`;

  return `export const updatedAt = ${JSON.stringify(updatedAt)};

const rawListings = [
  ${rows},
];

export const listings = rawListings.map(([source, district, price, priceText, title, area, metro, url, isNew, matchedConditions = [], missingConditions = []], index) => ({
  id: \`\${source}-\${index + 1}\`,
  source,
  district,
  price,
  priceText,
  title,
  area,
  metro,
  url,
  isNew,
  matchedConditions,
  missingConditions,
  conditionScore: matchedConditions.length,
}));
`;
}

const allListings = [];

for (const region of REGIONS) {
  for (const firstRow of region.rows) {
    const html = await fetchListPage(region.id, firstRow);
    const document = new JSDOM(html).window.document;
    const items = [...document.querySelectorAll(".item[data-id]")];
    allListings.push(...items.map(parseListing));
  }
}

const uniqueListings = [...new Map(allListings.map((listing) => [listing.url, listing])).values()];
const basicListings = uniqueListings.filter(shouldKeep);
console.log(`Checking ${basicListings.length} candidate listings against detail conditions...`);

const enrichedListings = await mapWithConcurrency(basicListings, 4, enrichListing);
const rejectedByGender = enrichedListings.filter((listing) => !listing.isMaleAllowed);
const listings = enrichedListings
  .filter((listing) => listing.isMaleAllowed)
  .sort((a, b) => {
    if (a.matchedConditions.length !== b.matchedConditions.length) {
      return b.matchedConditions.length - a.matchedConditions.length;
    }
    if (a.isNew !== b.isNew) return Number(b.isNew) - Number(a.isNew);
    return a.price - b.price;
  })
  .map(({ text, detailText, fullText, detailError, isMaleAllowed, ...listing }) => listing);

await fs.writeFile("src/data/listings.js", serializeListings(listings), "utf8");

const byDistrict = listings.reduce((counts, listing) => {
  counts[listing.district] = (counts[listing.district] || 0) + 1;
  return counts;
}, {});

console.log(`Updated ${listings.length} listings from 591.`);
console.log(
  Object.entries(byDistrict)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hant"))
    .map(([district, count]) => `${district} ${count}`)
    .join(", "),
);
console.log(
  `Rejected ${rejectedByGender.length} female-only candidates. Condition gaps among kept listings: ` +
    REQUIRED_CONDITIONS.map((condition) => {
      const count = listings.filter((listing) =>
        listing.missingConditions.includes(condition.label),
      ).length;
      return `${condition.label} ${count}`;
    }).join(", "),
);
