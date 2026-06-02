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
  { id: 1, rows: [0, 30, 60, 90, 120, 150, 180, 210] },
  { id: 3, rows: [0, 30, 60, 90, 120, 150, 180, 210] },
];

const BLOCKED_TEXT = [
  "限女性",
  "限女",
  "限單人",
  "限一人",
  "只限單人",
  "已出租",
  "雅房",
  "車位",
  "停車",
  "倉庫",
  "店面",
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

export const listings = rawListings.map(([source, district, price, priceText, title, area, metro, url, isNew], index) => ({
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
const listings = uniqueListings
  .filter(shouldKeep)
  .sort((a, b) => {
    if (a.isNew !== b.isNew) return Number(b.isNew) - Number(a.isNew);
    return a.price - b.price;
  })
  .map(({ text, ...listing }) => listing);

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
