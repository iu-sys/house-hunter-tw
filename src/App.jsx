import React, { useMemo, useState } from "react";
import {
  ArrowDownUp,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  ExternalLink,
  Filter,
  Flame,
  Gauge,
  Plane,
  Search,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import "./styles.css";

const conversionRate = 36.5;

const deals = [
  {
    id: "pus-tiger-0609",
    route: "釜山 PUS",
    country: "韓國",
    airline: "台灣虎航",
    departDate: "2026-06-09",
    returnDate: "2026-06-16",
    priceEur: 140,
    baggageEstimate: 2500,
    baggagePlan: "tigersmart 含 20kg",
    priority: "best",
    flight: "16:40 TPE -> 19:55 PUS",
    duration: "2 小時 15 分",
    source: "Google Flights",
    sourceUrl: "https://www.google.com/travel/flights",
    officialUrl: "https://www.tigerairtw.com/zh-tw/booking/flight",
    notes: "虎航直飛，裸票最低，含行李後仍有明顯預算空間。",
  },
  {
    id: "sel-tiger-0715",
    route: "首爾 ICN",
    country: "韓國",
    airline: "台灣虎航",
    departDate: "2026-07-15",
    returnDate: "2026-07-22",
    priceEur: 145,
    baggageEstimate: 2500,
    baggagePlan: "tigersmart 含 20kg",
    priority: "best",
    flight: "20:00 TPE -> 23:30 ICN",
    duration: "2 小時 30 分",
    source: "Google Flights",
    sourceUrl: "https://www.google.com/travel/flights",
    officialUrl: "https://www.tigerairtw.com/zh-tw/booking/flight",
    notes: "虎航優先候選，同日酷航與真航空也在低價帶。",
  },
  {
    id: "oka-tiger-1025",
    route: "沖繩 OKA",
    country: "日本",
    airline: "台灣虎航",
    departDate: "2026-10-25",
    returnDate: "2026-11-01",
    priceEur: 144,
    baggageEstimate: 2500,
    baggagePlan: "tigersmart 含 20kg",
    priority: "best",
    flight: "18:20 TPE -> 20:40 OKA",
    duration: "1 小時 20 分",
    source: "Google Flights",
    sourceUrl: "https://www.google.com/travel/flights",
    officialUrl: "https://www.tigerairtw.com/zh-tw/booking/flight",
    notes: "短程直飛，含行李後最穩的日本 1 萬內候選。",
  },
  {
    id: "oka-peach-1025",
    route: "沖繩 OKA",
    country: "日本",
    airline: "樂桃航空",
    departDate: "2026-10-25",
    returnDate: "2026-11-01",
    priceEur: 173,
    baggageEstimate: 1800,
    baggagePlan: "加購 20kg 估算",
    priority: "good",
    flight: "15:20 TPE -> 17:50 OKA",
    duration: "1 小時 30 分",
    source: "Google Flights",
    sourceUrl: "https://www.google.com/travel/flights",
    officialUrl: "https://www.flypeach.com/en",
    notes: "樂桃同日直飛，裸票略高但仍在可控範圍。",
  },
  {
    id: "kix-peach-0916",
    route: "大阪 KIX",
    country: "日本",
    airline: "樂桃航空",
    departDate: "2026-09-16",
    returnDate: "2026-09-23",
    priceEur: 178,
    baggageEstimate: 2000,
    baggagePlan: "加購 20kg 估算",
    priority: "good",
    flight: "18:15 TPE -> 22:00 KIX",
    duration: "2 小時 45 分",
    source: "Google Flights",
    sourceUrl: "https://www.google.com/travel/flights",
    officialUrl: "https://www.flypeach.com/en",
    notes: "大阪最低裸票，同日虎航約 EUR 212 起。",
  },
  {
    id: "tyo-peach-1029",
    route: "東京 NRT/HND",
    country: "日本",
    airline: "樂桃航空",
    departDate: "2026-10-29",
    returnDate: "2026-11-05",
    priceEur: 201,
    baggageEstimate: 2200,
    baggagePlan: "加購 20kg 估算",
    priority: "watch",
    flight: "10:40 TPE -> 14:55 NRT",
    duration: "3 小時 15 分",
    source: "Google Flights",
    sourceUrl: "https://www.google.com/travel/flights",
    officialUrl: "https://www.flypeach.com/en",
    notes: "東京線含行李後較接近上限，適合先鎖票再交叉查官網。",
  },
  {
    id: "kix-tiger-0916",
    route: "大阪 KIX",
    country: "日本",
    airline: "台灣虎航",
    departDate: "2026-09-16",
    returnDate: "2026-09-23",
    priceEur: 212,
    baggageEstimate: 2500,
    baggagePlan: "tigersmart 含 20kg",
    priority: "watch",
    flight: "16:25 TPE -> 20:15 KIX",
    duration: "2 小時 50 分",
    source: "Google Flights",
    sourceUrl: "https://www.google.com/travel/flights",
    officialUrl: "https://www.tigerairtw.com/zh-tw/booking/flight",
    notes: "虎航優先但較接近 NT$10,000，訂前需確認票種價差。",
  },
  {
    id: "tyo-tiger-1029",
    route: "東京 NRT/HND",
    country: "日本",
    airline: "台灣虎航",
    departDate: "2026-10-29",
    returnDate: "2026-11-05",
    priceEur: 237,
    baggageEstimate: 2500,
    baggagePlan: "tigersmart 含 20kg",
    priority: "risk",
    flight: "15:35 TPE -> 19:35 NRT",
    duration: "3 小時",
    source: "Google Flights",
    sourceUrl: "https://www.google.com/travel/flights",
    officialUrl: "https://www.tigerairtw.com/zh-tw/booking/flight",
    notes: "裸票好看，但含 20kg 後可能超過預算。",
  },
];

const airlineLinks = [
  ["台灣虎航", "https://www.tigerairtw.com/zh-tw/booking/flight"],
  ["樂桃航空", "https://www.flypeach.com/en"],
  ["酷航", "https://www.flyscoot.com"],
  ["濟州航空", "https://www.jejuair.net"],
  ["真航空", "https://www.jinair.com"],
  ["德威航空", "https://www.twayair.com"],
];

function toTwd(priceEur) {
  return Math.round(priceEur * conversionRate);
}

function totalEstimate(deal) {
  return toTwd(deal.priceEur) + deal.baggageEstimate;
}

function formatMoney(value) {
  return `NT$${Math.round(value).toLocaleString("zh-TW")}`;
}

function formatDateRange(deal) {
  return `${deal.departDate.replaceAll("-", "/")} - ${deal.returnDate.replaceAll("-", "/")}`;
}

function unique(values) {
  return [...new Set(values)];
}

const airlines = unique(deals.map((deal) => deal.airline));
const routes = unique(deals.map((deal) => deal.route));
const allCountries = ["日本", "韓國"];

export default function App() {
  const [selectedAirline, setSelectedAirline] = useState("全部");
  const [selectedRoute, setSelectedRoute] = useState("全部");
  const [selectedCountry, setSelectedCountry] = useState("全部");
  const [query, setQuery] = useState("");
  const [underBudgetOnly, setUnderBudgetOnly] = useState(true);
  const [tigerFirst, setTigerFirst] = useState(true);
  const [sortKey, setSortKey] = useState("score");
  const [selectedDealId, setSelectedDealId] = useState(deals[0].id);

  const visibleDeals = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = deals.filter((deal) => {
      const matchesAirline = selectedAirline === "全部" || deal.airline === selectedAirline;
      const matchesRoute = selectedRoute === "全部" || deal.route === selectedRoute;
      const matchesCountry = selectedCountry === "全部" || deal.country === selectedCountry;
      const matchesBudget = !underBudgetOnly || totalEstimate(deal) <= 10000;
      const matchesQuery =
        !normalizedQuery ||
        `${deal.route} ${deal.airline} ${deal.notes}`.toLowerCase().includes(normalizedQuery);

      return matchesAirline && matchesRoute && matchesCountry && matchesBudget && matchesQuery;
    });

    return filtered.sort((a, b) => {
      if (tigerFirst && a.airline !== b.airline) {
        if (a.airline === "台灣虎航") return -1;
        if (b.airline === "台灣虎航") return 1;
      }

      if (sortKey === "date") return a.departDate.localeCompare(b.departDate);
      if (sortKey === "route") return a.route.localeCompare(b.route, "zh-Hant");
      if (sortKey === "airline") return a.airline.localeCompare(b.airline, "zh-Hant");
      return totalEstimate(a) - totalEstimate(b);
    });
  }, [query, selectedAirline, selectedCountry, selectedRoute, sortKey, tigerFirst, underBudgetOnly]);

  const selectedDeal = visibleDeals.find((deal) => deal.id === selectedDealId) || visibleDeals[0];
  const bestDeal = deals.reduce((best, deal) => (totalEstimate(deal) < totalEstimate(best) ? deal : best));
  const underBudgetCount = deals.filter((deal) => totalEstimate(deal) <= 10000).length;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Plane size={23} />
          </span>
          <div>
            <h1>機票獵人</h1>
            <p>台北桃園 TPE 出發，日本/韓國促銷來回票雷達</p>
          </div>
        </div>
        <div className="top-actions" aria-label="查詢條件">
          <span>台北桃園 TPE</span>
          <span>≤ NT$10,000</span>
          <span>含行李</span>
          <span>虎航優先</span>
        </div>
      </header>

      <section className="hero-panel" aria-label="搜尋摘要">
        <div>
          <h2>來回含行李 ≤ NT$10,000</h2>
          <p>
            依 2026-06-02 查到的 Google Flights 價格整理，裸票以 EUR 顯示並換算台幣，
            行李費以 20kg 估算；實際結帳仍請回航空官網確認。
          </p>
        </div>
        <div className="search-box">
          <Search size={18} />
          <input
            aria-label="搜尋航點或航空公司"
            placeholder="搜尋航點、航空公司、備註"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </section>

      <section className="summary-grid" aria-label="票價統計">
        <Stat icon={<Flame size={18} />} label="最便宜候選" value={`${bestDeal.route} ${formatMoney(totalEstimate(bestDeal))}`} />
        <Stat icon={<ShieldCheck size={18} />} label="預算內筆數" value={`${underBudgetCount} 筆`} />
        <Stat icon={<Briefcase size={18} />} label="行李規格" value="20kg 估算" />
        <Stat icon={<Gauge size={18} />} label="匯率假設" value={`€1 = NT$${conversionRate}`} />
      </section>

      <div className="workspace">
        <aside className="filters" aria-label="篩選條件">
          <div className="section-title">
            <Filter size={17} />
            <span>篩選</span>
          </div>

          <FilterGroup label="航空公司">
            {["全部", ...airlines].map((airline) => (
              <button
                className={selectedAirline === airline ? "chip active" : "chip"}
                key={airline}
                onClick={() => setSelectedAirline(airline)}
              >
                {airline}
              </button>
            ))}
          </FilterGroup>

          <FilterGroup label="目的地">
            <select value={selectedRoute} onChange={(event) => setSelectedRoute(event.target.value)}>
              {["全部", ...routes].map((route) => (
                <option key={route} value={route}>
                  {route}
                </option>
              ))}
            </select>
          </FilterGroup>

          <FilterGroup label="國家">
            <div className="segmented">
              {["全部", ...allCountries].map((country) => (
                <button
                  className={selectedCountry === country ? "active" : ""}
                  key={country}
                  onClick={() => setSelectedCountry(country)}
                >
                  {country}
                </button>
              ))}
            </div>
          </FilterGroup>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={underBudgetOnly}
              onChange={(event) => setUnderBudgetOnly(event.target.checked)}
            />
            只看估算含行李 ≤ NT$10,000
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={tigerFirst}
              onChange={(event) => setTigerFirst(event.target.checked)}
            />
            虎航優先排序
          </label>

          <FilterGroup label="排序">
            <label className="sort-control">
              <ArrowDownUp size={16} />
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
                <option value="score">含行李估算低到高</option>
                <option value="date">出發日期</option>
                <option value="route">航點</option>
                <option value="airline">航空公司</option>
              </select>
            </label>
          </FilterGroup>
        </aside>

        <section className="results" aria-label="低價機票清單">
          <div className="toolbar">
            <div>
              <h2>低價候選清單</h2>
              <p>
                顯示 {visibleDeals.length} 筆，依目前篩選條件排序。價格為查詢當下資訊，可能隨時變動。
              </p>
            </div>
          </div>

          <div className="deal-board">
            {visibleDeals.map((deal) => (
              <button
                className={selectedDeal?.id === deal.id ? "deal-row selected" : "deal-row"}
                key={deal.id}
                onClick={() => setSelectedDealId(deal.id)}
              >
                <span className={`status-dot status-${deal.priority}`} />
                <span className="deal-main">
                  <strong>{deal.route}</strong>
                  <small>{deal.airline} · {deal.country} · {deal.duration}</small>
                </span>
                <span className="deal-date">
                  <CalendarDays size={15} />
                  {formatDateRange(deal)}
                </span>
                <span className="deal-price">
                  <strong>{formatMoney(totalEstimate(deal))}</strong>
                  <small>裸票 €{deal.priceEur} + 行李估</small>
                </span>
                <span className={totalEstimate(deal) <= 10000 ? "budget yes" : "budget no"}>
                  {totalEstimate(deal) <= 10000 ? "預算內" : "壓線"}
                </span>
              </button>
            ))}

            {visibleDeals.length === 0 && (
              <div className="empty-state">
                <Ticket size={24} />
                <h3>沒有符合的票</h3>
                <p>放寬預算或清除航空公司篩選，再重新比較。</p>
              </div>
            )}
          </div>
        </section>

        <aside className="detail" aria-label="選中航班細節">
          {selectedDeal ? (
            <>
              <div className="detail-head">
                <span className="detail-icon">
                  <BadgeCheck size={20} />
                </span>
                <span>{selectedDeal.source}</span>
              </div>
              <h2>{selectedDeal.route}</h2>
              <p>{selectedDeal.notes}</p>
              <div className="detail-price">{formatMoney(totalEstimate(selectedDeal))}</div>
              <dl>
                <div>
                  <dt>航空公司</dt>
                  <dd>{selectedDeal.airline}</dd>
                </div>
                <div>
                  <dt>日期</dt>
                  <dd>{formatDateRange(selectedDeal)}</dd>
                </div>
                <div>
                  <dt>航班</dt>
                  <dd>{selectedDeal.flight}</dd>
                </div>
                <div>
                  <dt>行李</dt>
                  <dd>{selectedDeal.baggagePlan}</dd>
                </div>
                <div>
                  <dt>裸票</dt>
                  <dd>€{selectedDeal.priceEur} 約 {formatMoney(toTwd(selectedDeal.priceEur))}</dd>
                </div>
              </dl>
              <div className="detail-actions">
                <a href={selectedDeal.sourceUrl} target="_blank" rel="noreferrer">
                  Google Flights
                  <ExternalLink size={15} />
                </a>
                <a href={selectedDeal.officialUrl} target="_blank" rel="noreferrer">
                  航空官網
                  <ExternalLink size={15} />
                </a>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <Ticket size={24} />
              <h3>選一筆票價</h3>
              <p>點選清單中的航班後，這裡會顯示行李與訂票連結。</p>
            </div>
          )}

          <div className="manual-links">
            <h3>手動複查官網</h3>
            {airlineLinks.map(([label, url]) => (
              <a href={url} key={label} target="_blank" rel="noreferrer">
                {label}
                <ExternalLink size={14} />
              </a>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="stat">
      <span className="stat-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FilterGroup({ label, children }) {
  return (
    <section className="filter-group">
      <h3>{label}</h3>
      {children}
    </section>
  );
}
