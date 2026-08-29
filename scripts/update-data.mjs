import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { JSDOM } from "jsdom";
import {
  DETAIL_FETCH_FAILURE_LABEL,
  getMaxListPage,
  hasNonResidentialSuiteText,
  hasSingleOccupantRestrictionText,
  normalizeListingForWrite,
  prepareListingsForEnrichment,
  resolveListingWritePlan,
  shouldDropListingAfterStatusCode,
  shouldDropListingAfterDetailError,
} from "./update-data-utils.mjs";
import { listings as previousListings } from "../src/data/listings.js";

const execFileAsync = promisify(execFile);

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

const REGIONS = [1, 3];

const PTT_BOARDS = ["Rent_tao", "Rent_apart"];
const PTT_MAX_PAGES_PER_BOARD = 8;
const PTT_RECENT_DAYS = 3;
const MIN_SAFE_LISTING_COUNT = 500;
const LIST_PAGE_CONCURRENCY = Number(process.env.LIST_PAGE_CONCURRENCY || 12);
const DETAIL_CONCURRENCY = Number(process.env.DETAIL_CONCURRENCY || 12);
const PTT_ARTICLE_CONCURRENCY = Number(process.env.PTT_ARTICLE_CONCURRENCY || 8);
const LIVE_STATUS_CONCURRENCY = Number(process.env.LIVE_STATUS_CONCURRENCY || 16);
const SEARCH_TEXT_MAX_LENGTH = 2500;

const BLOCKED_TEXT = [
  "車位",
  "停車",
  "機車位",
  "汽車位",
  "汽車機械車位",
  "倉庫",
  "店面",
  "限女性",
  "限女",
  "限單人",
  "限一人",
  "只限單人",
  "限1人",
  "單人入住",
  "已出租",
  "雅房",
  "倉庫",
  "店面",
  "公司登記",
  "工商登記",
  "戶籍登記",
  "入戶口",
  "代收信件",
];

const PTT_BLOCKED_TITLE_TEXT = [...BLOCKED_TEXT, "車位", "停車"];

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

FEMALE_ONLY_PATTERNS.splice(
  0,
  FEMALE_ONLY_PATTERNS.length,
  /\u5973\u6027/u,
  /\u9650\s*\u5973/u,
  /\u9650\s*\u5973\u6027/u,
  /\u5973\u751f/u,
  /\u5973\u58eb/u,
  /\u5973\u4ed5/u,
  /\u5973\u5b69/u,
  /\u5973\u6027\u5c08\u5c6c/u,
  /\u5973\u6027\u9996\u9078/u,
  /female/i,
);

const EXCLUDED_LISTING_PATTERNS = [
  /\u5973\u6027/u,
  /\u9650\s*\u5973/u,
  /\u5973\u751f/u,
  /\u5973\u4ed5/u,
  /\u5973\u5b69/u,
  /female/i,
  /\u9650\s*\u55ae\u4eba/u,
  /\u9650\s*[1\u4e00]\s*\u4eba/u,
  /\u55ae\u4eba\u5165\u4f4f/u,
  /\u4e00\u4eba\u5165\u4f4f/u,
  /\u50c5\u9650\u4e00\u4eba/u,
  /\u96c5\u623f/u,
  /\u8eca\u4f4d/u,
  /\u505c\u8eca/u,
  /\u5009\u5eab/u,
  /\u5e97\u9762/u,
  /\u5e97\u8216/u,
  /\u5546\u8216/u,
  /\u5df2\u51fa\u79df/u,
  /\u5df2\u79df\u51fa/u,
  /\u5df2\u6536\u8a02/u,
  /\u5df2\u6536\u8a02\u91d1/u,
];

const ADMIN_ONLY_PATTERNS = [/\u6236\u7c4d/u, /\u5b78\u5340/u];

const REQUIRED_CONDITIONS = [
  { label: "對外窗", test: (text) => hasExteriorWindow(text) },
  { label: "捷運10分內", test: (text) => isMetroWithinTenMinutes(text) },
  { label: "有網路", test: (text) => /網路|寬頻|Wi-?Fi|wifi/i.test(text) },
  { label: "衣櫃", test: (text) => /衣櫃|衣柜/.test(text) },
  { label: "有租補", test: (text) => /租補|租屋補助|可申請補助|補助/.test(text) },
  { label: "台水台電或電費5元內", test: (text) => hasAcceptableUtilityRate(text) },
  { label: "711走路2分鐘內", test: (text) => hasSevenElevenWithinTwoMinutes(text) },
  { label: "冰箱", test: (text) => text.includes("冰箱") },
  { label: "電視", test: (text) => text.includes("電視") },
];

const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function findTargetDistrict(text) {
  return TARGET_DISTRICTS.find((district) => text.includes(district)) || "";
}

function findTargetDistrictBySegment(text) {
  const segments = text
    .split(/[\/\s,，、\[\]［］()（）-]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  return (
    TARGET_DISTRICTS.find((district) =>
      segments.some(
        (segment) =>
          segment === district ||
          segment === district.replace(/區$/, "") ||
          segment === `台北${district}` ||
          segment === `臺北${district}` ||
          segment === `新北${district}`,
      ),
    ) || ""
  );
}

function findPttDistrict(title, fullText) {
  const bracketText = title.match(/^\[[^\]]+\]/)?.[0] || "";
  return (
    findTargetDistrictBySegment(bracketText) ||
    findTargetDistrict(title) ||
    findTargetDistrict(fullText)
  );
}

function isPttFemaleOnlyTitle(title) {
  return /^\[\s*女\s*\//.test(title);
}

function hasExcludedListingText(text) {
  return (
    EXCLUDED_LISTING_PATTERNS.some((pattern) => pattern.test(text)) ||
    hasSingleOccupantRestrictionText(text) ||
    hasNonResidentialSuiteText(text)
  );
}

function getListingRestrictionText(listing) {
  return [
    listing?.title,
    listing?.text,
    listing?.searchText,
    listing?.detailText,
    listing?.fullText,
    listing?.url,
  ]
    .filter(Boolean)
    .join(" ");
}

function hasSingleOccupantRestrictionListing(listing) {
  return hasSingleOccupantRestrictionText(getListingRestrictionText(listing));
}

function isAdministrativeOnlyListing(listing, text) {
  return listing.price < 4000 && ADMIN_ONLY_PATTERNS.some((pattern) => pattern.test(text));
}

function buildUrl(region, page = 1) {
  const params = new URLSearchParams({
    region: String(region),
    kind: "2,3",
    rentprice: "0,15000",
    order: "posttime",
    orderType: "desc",
  });
  if (page > 1) params.set("page", String(page));
  return `https://rent.591.com.tw/list?${params.toString()}`;
}

async function fetchListPage(region, page = 1) {
  const url = buildUrl(region, page);
  return fetchWithRetry(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: "https://rent.591.com.tw/",
      "User-Agent": userAgent,
    },
  });
}

function getListPageCount(document) {
  return getMaxListPage(
    [...document.querySelectorAll("a")]
      .map((link) => link.getAttribute("href") || "")
      .filter((href) => href.includes("/list?") && href.includes("page=")),
  );
}

async function fetchDetailPage(url) {
  return fetchWithRetry(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: "https://rent.591.com.tw/list?region=1&kind=2,3",
      "User-Agent": userAgent,
    },
  });
}

async function fetchWithRetry(url, options = {}, retries = 3) {
  let lastError = null;
  const headers = options.headers || {};

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const args = [
        "-sS",
        "-L",
        "--fail",
        "--compressed",
        "--connect-timeout",
        "15",
        "--speed-limit",
        "500",
        "--speed-time",
        "20",
        "--max-time",
        "45",
      ];

      for (const [name, value] of Object.entries(headers)) {
        args.push("-H", `${name}: ${value}`);
      }

      args.push(url);

      const { stdout } = await execFileAsync("curl", args, {
        encoding: "utf8",
        maxBuffer: 30 * 1024 * 1024,
      });

      return stdout;
    } catch (error) {
      if (
        typeof error.stdout === "string" &&
        error.stdout.includes("<html") &&
        error.stdout.includes("data-id")
      ) {
        return error.stdout;
      }

      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
    }
  }

  throw lastError;
}

async function fetchStatusCode(url, headers = {}) {
  const args = [
    "-sS",
    "-L",
    "--compressed",
    "--connect-timeout",
    "15",
    "--max-time",
    "25",
    "-o",
    "NUL",
    "-w",
    "%{http_code}",
  ];

  for (const [name, value] of Object.entries(headers)) {
    args.push("-H", `${name}: ${value}`);
  }

  args.push(url);

  const { stdout } = await execFileAsync("curl", args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });

  return Number(String(stdout || "").trim());
}

async function fetchPttPage(board, page = "index") {
  const url = `https://www.ptt.cc/bbs/${board}/${page}.html`;
  return fetchWithRetry(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      Cookie: "over18=1",
      "User-Agent": userAgent,
    },
  });
}

function getPttPreviousPage(document) {
  const previous = [...document.querySelectorAll("a.btn.wide")].find((link) =>
    link.textContent.includes("上頁"),
  );
  const href = previous?.getAttribute("href") || "";
  return href.match(/(index\d+)\.html/)?.[1] || "";
}

function getPttArticleDate(document, fallbackDateText) {
  const metaValues = [...document.querySelectorAll(".article-meta-value")].map((node) =>
    node.textContent.trim(),
  );
  const dateText = metaValues[3] || "";
  const parsed = Date.parse(dateText);
  if (!Number.isNaN(parsed)) return new Date(parsed);

  const taipeiNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const fallbackMatch = fallbackDateText.match(/(\d{1,2})\/(\d{1,2})/);
  if (!fallbackMatch) return taipeiNow;
  const fallback = new Date(taipeiNow);
  fallback.setMonth(Number(fallbackMatch[1]) - 1, Number(fallbackMatch[2]));
  fallback.setHours(0, 0, 0, 0);
  return fallback;
}

function cleanPttContent(document) {
  const main = document.querySelector("#main-content");
  if (!main) return "";

  for (const node of [...main.querySelectorAll(".article-metaline, .article-metaline-right, .push")]) {
    node.remove();
  }

  return main.textContent
    .replace(/※ 發信站:.*$/gms, "")
    .replace(/--\s*$/gms, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPrice(text) {
  const pricePatterns = [
    /(?:租金|租屋費用|價格|月租|租金[:：]?)[^\d]{0,30}([\d,]{4,6})/i,
    /([\d,]{4,6})\s*(?:元\/月|元\s*\/\s*月|元|\/月)/i,
  ];

  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1].replace(/,/g, ""));
  }

  return 0;
}

function extractMetro(text) {
  const metroMatch =
    text.match(/(?:近|距|捷運站|捷運)\s*([^，,。；;\s]{1,12})(?:站|捷運)?/) ||
    text.match(/([^，,。；;\s]{1,12})(?:捷運站|站)\s*(?:步行|走路|徒歩)?/);
  return metroMatch?.[1] || "";
}

function parsePttListing({ board, title, url, dateText, document }) {
  const content = cleanPttContent(document);
  const fullText = `${title} ${content}`;
  const district = findPttDistrict(title, fullText);
  const price = extractPrice(fullText);
  const area = fullText.match(/(\d+(?:\.\d+)?)\s*坪/)?.[0] || "";
  const metro = extractMetro(fullText);
  const articleDate = getPttArticleDate(document, dateText);
  const matchedConditions = matchedRequiredConditions(fullText);
  const missingConditions = missingRequiredConditions(fullText);

  return {
    source: "PTT",
    board,
    district,
    price,
    priceText: price ? `${price.toLocaleString("zh-TW")}元/月` : "",
    title,
    area,
    metro,
    sourceUrl: url,
    url,
    isNew: true,
    text: fullText,
    detailText: content,
    fullText,
    matchedConditions,
    missingConditions,
    isMaleAllowed:
      !isPttFemaleOnlyTitle(title) &&
      !FEMALE_ONLY_PATTERNS.some((pattern) => pattern.test(fullText)),
    articleDate,
  };
}

async function fetchPttListings() {
  const taipeiNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const cutoff = new Date(taipeiNow);
  cutoff.setDate(cutoff.getDate() - PTT_RECENT_DAYS);
  const listings = [];

  for (const board of PTT_BOARDS) {
    let page = "index";
    try {

    for (let pageCount = 0; page && pageCount < PTT_MAX_PAGES_PER_BOARD; pageCount += 1) {
      const html = await fetchPttPage(board, page);
      const document = new JSDOM(html).window.document;
      const entries = [...document.querySelectorAll(".r-ent")]
        .map((entry) => {
          const link = entry.querySelector(".title a");
          const title = link?.textContent.trim() || "";
          const href = link?.getAttribute("href") || "";
          return {
            title,
            url: href ? `https://www.ptt.cc${href}` : "",
            dateText: entry.querySelector(".date")?.textContent.trim() || "",
          };
        })
        .filter((entry) => entry.url && entry.title);

      for (const entry of entries) {
        if (entry.title.includes("[徵求]") || entry.title.includes("公告")) continue;
        if (isPttFemaleOnlyTitle(entry.title)) continue;
        if (PTT_BLOCKED_TITLE_TEXT.some((blocked) => entry.title.includes(blocked))) continue;

        let articleHtml = "";
        try {
          articleHtml = await fetchWithRetry(entry.url, {
            headers: {
              Accept: "text/html,application/xhtml+xml",
              Cookie: "over18=1",
              "User-Agent": userAgent,
            },
          });
        } catch (error) {
          console.warn(`Skipped PTT article ${entry.url}: ${error.message}`);
          continue;
        }

        const articleDocument = new JSDOM(articleHtml).window.document;
        const articleDate = getPttArticleDate(articleDocument, entry.dateText);
        if (articleDate < cutoff) continue;

        const listing = parsePttListing({
          board,
          title: entry.title,
          url: entry.url,
          dateText: entry.dateText,
          document: articleDocument,
        });

        if (shouldKeep(listing) && listing.text.includes("套房")) listings.push(listing);
      }

      page = getPttPreviousPage(document);
    }
    } catch (error) {
      console.warn(`Skipped PTT board ${board}: ${error.message}`);
    }
  }

  return listings;
}

async function fetchPttListingsFast() {
  const taipeiNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const cutoff = new Date(taipeiNow);
  cutoff.setDate(cutoff.getDate() - PTT_RECENT_DAYS);
  const listings = [];

  for (const board of PTT_BOARDS) {
    let page = "index";

    try {
      for (let pageCount = 0; page && pageCount < PTT_MAX_PAGES_PER_BOARD; pageCount += 1) {
        console.log(`PTT page progress: ${board} ${pageCount + 1}/${PTT_MAX_PAGES_PER_BOARD}`);
        const html = await fetchPttPage(board, page);
        const document = new JSDOM(html).window.document;
        const entries = [...document.querySelectorAll(".r-ent")]
          .map((entry) => {
            const link = entry.querySelector(".title a");
            const title = link?.textContent.trim() || "";
            const href = link?.getAttribute("href") || "";
            return {
              title,
              url: href ? `https://www.ptt.cc${href}` : "",
              dateText: entry.querySelector(".date")?.textContent.trim() || "",
            };
          })
          .filter((entry) => entry.url && entry.title)
          .filter(
            (entry) =>
              !entry.title.includes("[敺菜?]") &&
              !entry.title.includes("?砍?") &&
              !isPttFemaleOnlyTitle(entry.title) &&
              !PTT_BLOCKED_TITLE_TEXT.some((blocked) => entry.title.includes(blocked)),
          );

        const pageListings = await mapWithProgress(
          entries,
          PTT_ARTICLE_CONCURRENCY,
          async (entry) => {
            try {
              const articleHtml = await fetchWithRetry(entry.url, {
                headers: {
                  Accept: "text/html,application/xhtml+xml",
                  Cookie: "over18=1",
                  "User-Agent": userAgent,
                },
              });
              const articleDocument = new JSDOM(articleHtml).window.document;
              const articleDate = getPttArticleDate(articleDocument, entry.dateText);
              if (articleDate < cutoff) return null;

              const listing = parsePttListing({
                board,
                title: entry.title,
                url: entry.url,
                dateText: entry.dateText,
                document: articleDocument,
              });

              return shouldKeep(listing) && listing.text.includes("憟") ? listing : null;
            } catch (error) {
              console.warn(`Skipped PTT article ${entry.url}: ${error.message}`);
              return null;
            }
          },
          `PTT article progress ${board} page ${pageCount + 1}`,
        );

        listings.push(...pageListings.filter(Boolean));
        page = getPttPreviousPage(document);
      }
    } catch (error) {
      console.warn(`Skipped PTT board ${board}: ${error.message}`);
    }
  }

  return listings;
}

function isMetroWithinTenMinutes(text) {
  const distanceMatches = [...text.matchAll(/距[^0-9\s]{1,20}\s*(\d{2,4})\s*公尺/g)];
  if (distanceMatches.some((match) => Number(match[1]) <= 800)) return true;

  return (
    /捷運.{0,15}(10分|十分|10分鐘|[1-9]分|[1-9]分鐘)/.test(text) ||
    /(10分|十分|10分鐘|[1-9]分|[1-9]分鐘).{0,15}捷運/.test(text)
  );
}

function hasExteriorWindow(text) {
  if (/(?:無|沒|没有|沒有|非|不是).{0,3}對外窗|對外窗\s*[:：]\s*(?:無|否|沒有)|無窗|暗房/.test(text)) {
    return false;
  }

  return /對外窗|外窗/.test(text);
}

function hasAcceptableUtilityRate(text) {
  if (/台水台電|台電台水/.test(text)) return true;
  if (text.includes("台水") && text.includes("台電")) return true;
  if (/台電.{0,8}(?:計費|計價|收費)|(?:計費|計價).{0,8}台電|獨立電表.{0,8}台電|依.{0,8}台電/.test(text)) {
    return true;
  }

  const utilityPatterns = [
    /電費.{0,12}([1-5](?:\.\d+)?)\s*元/,
    /([1-5](?:\.\d+)?)\s*元\s*\/?\s*度/,
    /一度.{0,8}([1-5](?:\.\d+)?)/,
    /每度.{0,8}([1-5](?:\.\d+)?)/,
  ];

  return utilityPatterns.some((pattern) => pattern.test(text));
}

function hasSevenElevenWithinTwoMinutes(text) {
  const storePattern = /(?:7-11|711|7-ELEVEN|便利商店|超商)/i;
  const directMinutePattern = /(?:7-11|711|7-ELEVEN|便利商店|超商).{0,30}(?:走路|步行)?\s*(?:2\s*分|2\s*分鐘|二\s*分|二\s*分鐘)|(?:走路|步行)?\s*(?:2\s*分|2\s*分鐘|二\s*分|二\s*分鐘).{0,30}(?:7-11|711|7-ELEVEN|便利商店|超商)/i;
  if (directMinutePattern.test(text)) return true;

  const distanceMatches = [
    ...text.matchAll(/(?:7-11|711|7-ELEVEN|便利商店|超商)[^0-9]{0,30}(\d{1,4})\s*公尺/gi),
    ...text.matchAll(/距(?:7-11|711|7-ELEVEN|便利商店|超商)[^0-9]{0,30}(\d{1,4})\s*公尺/gi),
  ];

  if (distanceMatches.some((match) => Number(match[1]) <= 160)) return true;
  return storePattern.test(text) && /2\s*分|2\s*分鐘|二\s*分|二\s*分鐘/.test(text);
}

function normalizeImageUrl(value) {
  const url = String(value || "").trim();
  if (!url || url.startsWith("data:")) return "";
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://rent.591.com.tw${url}`;
  if (/^https?:\/\//i.test(url)) return url;
  return "";
}

function extractListingImageUrl(document) {
  const candidates = [
    document.querySelector('meta[property="og:image"]')?.getAttribute("content"),
    document.querySelector('meta[name="twitter:image"]')?.getAttribute("content"),
    ...[...document.querySelectorAll("img")]
      .flatMap((image) => [
        image.getAttribute("data-src"),
        image.getAttribute("data-original"),
        image.getAttribute("src"),
      ])
      .filter(Boolean),
  ];

  return candidates.map(normalizeImageUrl).find((url) => /591|addcn|img/.test(url)) || "";
}

function parseListing(item) {
  const text = item.textContent.replace(/\s+/g, " ").trim();
  const link = item.querySelector(".item-info-title a");
  const image = item.querySelector("img");
  const title = link?.getAttribute("title")?.trim() || link?.textContent.trim() || "";
  const id = item.getAttribute("data-id") || "";
  const price = Number(
    item.querySelector(".item-info-price strong")?.textContent.replace(/[^\d]/g, "") || 0,
  );
  const district = findTargetDistrict(text);
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
    sourceUrl: sourceUrl,
    url: sourceUrl,
    imageUrl: normalizeImageUrl(
      image?.getAttribute("data-src") ||
        image?.getAttribute("data-original") ||
        image?.getAttribute("src") ||
        "",
    ),
    isNew,
    text,
  };
}

function shouldKeep(listing) {
  if (!listing.url || !listing.title || !listing.district) return false;
  if (!listing.price || listing.price > 15000) return false;
  const listingText = `${listing.title} ${listing.text} ${listing.url}`;
  if (BLOCKED_TEXT.some((blocked) => listingText.includes(blocked))) {
    return false;
  }
  if (hasExcludedListingText(listingText)) {
    return false;
  }
  if (isAdministrativeOnlyListing(listing, listingText)) {
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
  if (listing.source === "PTT") return listing;

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
      imageUrl: listing.imageUrl || extractListingImageUrl(document),
      matchedConditions,
      missingConditions: missingRequiredConditions(fullText),
      isMaleAllowed: !FEMALE_ONLY_PATTERNS.some((pattern) => pattern.test(fullText)),
    };
  } catch (error) {
    if (shouldDropListingAfterDetailError(listing, error)) {
      console.warn(`Dropped stale 591 listing ${listing.url}: ${error.message}`);
      return null;
    }

    const fullText = `${listing.title} ${listing.text}`;
    const matchedConditions = matchedRequiredConditions(fullText);
    return {
      ...listing,
      detailText: "",
      fullText,
      imageUrl: listing.imageUrl || "",
      matchedConditions,
      missingConditions: [...missingRequiredConditions(fullText), DETAIL_FETCH_FAILURE_LABEL],
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

async function mapWithProgress(items, limit, mapper, label) {
  let completed = 0;

  return mapWithConcurrency(items, limit, async (...args) => {
    const result = await mapper(...args);
    completed += 1;

    if (
      completed === items.length ||
      completed === 1 ||
      completed % Math.max(10, Math.floor(items.length / 10)) === 0
    ) {
      console.log(`${label}: ${completed}/${items.length}`);
    }

    return result;
  });
}

async function verifyReusedListingsStillLive(listings) {
  return (
    await mapWithProgress(
      listings,
      LIVE_STATUS_CONCURRENCY,
      async (listing) => {
        if (listing.source !== "591") return listing;

        try {
          const statusCode = await fetchStatusCode(listing.sourceUrl || listing.url, {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            Referer: "https://rent.591.com.tw/list?region=1&kind=2,3",
            "User-Agent": userAgent,
          });

          if (shouldDropListingAfterStatusCode(listing, statusCode)) {
            console.warn(
              `Dropped stale reused 591 listing ${listing.sourceUrl || listing.url}: status ${statusCode}`,
            );
            return null;
          }

          return listing;
        } catch (error) {
          console.warn(
            `Skipped live status check for reused 591 listing ${listing.sourceUrl || listing.url}: ${error.message}`,
          );
          return listing;
        }
      },
      "Reused listing live check",
    )
  ).filter(Boolean);
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
        listing.sourceUrl || listing.url,
        listing.url,
        listing.isNew,
        listing.matchedConditions,
        listing.missingConditions,
        listing.searchText || "",
        listing.imageUrl || "",
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

export const listings = rawListings.map(([source, district, price, priceText, title, area, metro, sourceUrl, url, isNew, matchedConditions = [], missingConditions = [], searchText = "", imageUrl = ""], index) => ({
  id: \`\${source}-\${index + 1}\`,
  source,
  district,
  price,
  priceText,
  title,
  area,
  metro,
  sourceUrl,
  url,
  isNew,
  matchedConditions,
  missingConditions,
  searchText,
  imageUrl,
  conditionScore: matchedConditions.length,
}));
`;
}

function normalizeSearchText(text) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, SEARCH_TEXT_MAX_LENGTH);
}

const allListings = [];
const regionFirstPages = await mapWithConcurrency(REGIONS, 2, async (region) => {
  try {
    const html = await fetchListPage(region, 1);
    const document = new JSDOM(html).window.document;
    return {
      region,
      html,
      pageCount: getListPageCount(document),
      listings: [...document.querySelectorAll(".item[data-id]")].map(parseListing),
    };
  } catch (error) {
    console.warn(`Skipped 591 first list page region=${region}: ${error.message}`);
    return {
      region,
      html: "",
      pageCount: 0,
      listings: [],
    };
  }
});

const listTargets = regionFirstPages.flatMap(({ region, pageCount }) =>
  Array.from({ length: Math.max(pageCount - 1, 0) }, (_, index) => ({
    region,
    page: index + 2,
  })),
);

const listPages = [
  ...regionFirstPages.map(({ listings }) => listings),
  ...(await mapWithProgress(listTargets, LIST_PAGE_CONCURRENCY, async ({ region, page }) => {
    try {
      const html = await fetchListPage(region, page);
      const document = new JSDOM(html).window.document;
      return [...document.querySelectorAll(".item[data-id]")].map(parseListing);
    } catch (error) {
      console.warn(`Skipped 591 list page region=${region} page=${page}: ${error.message}`);
      return [];
    }
  }, "List page progress")),
];

allListings.push(...listPages.flat());

const pttListings = await fetchPttListingsFast();
allListings.push(...pttListings);

const uniqueListings = [...new Map(allListings.map((listing) => [listing.url, listing])).values()];
const basicListings = uniqueListings.filter(shouldKeep);
const previousListingsByUrl = new Map(
  previousListings
    .filter((listing) => listing.source === "591")
    .map((listing) => [listing.sourceUrl || listing.url, listing]),
);
const { readyListings, listingsNeedingEnrichment } = prepareListingsForEnrichment(
  basicListings,
  previousListingsByUrl,
);
const verifiedReadyListings = await verifyReusedListingsStillLive(readyListings);
console.log(
  `Checking ${listingsNeedingEnrichment.length} candidate listings against detail conditions ` +
    `(${verifiedReadyListings.length} reused from previous data after live-link checks)...`,
);

const enrichedListings = [
  ...verifiedReadyListings,
  ...(await mapWithProgress(
    listingsNeedingEnrichment,
    DETAIL_CONCURRENCY,
    enrichListing,
    "Detail enrichment progress",
  )).filter(Boolean),
];
const rejectedByGender = enrichedListings.filter((listing) => !listing.isMaleAllowed);
const nextListings = enrichedListings
  .filter((listing) => listing.isMaleAllowed)
  .filter((listing) => !hasSingleOccupantRestrictionListing(listing))
  .sort((a, b) => {
    if (a.matchedConditions.length !== b.matchedConditions.length) {
      return b.matchedConditions.length - a.matchedConditions.length;
    }
    if (a.isNew !== b.isNew) return Number(b.isNew) - Number(a.isNew);
    return a.price - b.price;
  })
  .map(({ text, detailText, fullText, detailError, isMaleAllowed, ...listing }) => ({
    ...listing,
    searchText: normalizeSearchText(fullText || `${listing.title} ${text || ""}`),
  }));
const fallbackListings = previousListings.filter(
  (listing) => !hasSingleOccupantRestrictionListing(listing),
);

const writePlan = resolveListingWritePlan({
  nextListings,
  previousListings: fallbackListings,
  minSafeListingCount: MIN_SAFE_LISTING_COUNT,
});
const listings = writePlan.listings.map(normalizeListingForWrite);

if (writePlan.warning) {
  console.warn(writePlan.warning);
}

await fs.writeFile("src/data/listings.js", serializeListings(listings), "utf8");

const byDistrict = listings.reduce((counts, listing) => {
  counts[listing.district] = (counts[listing.district] || 0) + 1;
  return counts;
}, {});

console.log(
  writePlan.mode === "fresh"
    ? `Updated ${listings.length} listings from 591 and PTT.`
    : `Kept previous ${listings.length} listings because the fresh scrape was incomplete.`,
);
console.log(`PTT kept ${listings.filter((listing) => listing.source === "PTT").length} listings.`);
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
