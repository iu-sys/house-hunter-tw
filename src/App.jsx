import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  Bell,
  ExternalLink,
  Home,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  applyCustomConditions,
  baseConditionLabels,
  defaultCustomRule,
} from "./customConditions.js";
import { listings, updatedAt } from "./data/listings.js";
import { applyFilters, formatDistrictSummary, getStats, sortListings } from "./listingUtils.js";
import "./styles.css";

const taipeiDistricts = [
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
];
const newTaipeiTargetDistricts = ["板橋區", "三重區", "中和區", "永和區", "新店區", "土城區"];
const districts = [
  ...new Set([
    ...taipeiDistricts,
    ...newTaipeiTargetDistricts,
    ...listings.map((listing) => listing.district),
  ]),
].sort((a, b) => a.localeCompare(b, "zh-Hant"));
const knownSources = ["591", "PTT", "Facebook"];
const sources = [...new Set([...knownSources, ...listings.map((listing) => listing.source)])];

const conditionSortLabel = "\u689d\u4ef6\u7b26\u5408\u5ea6";
const conditionColumnLabel = "\u689d\u4ef6";
const conditionMatchLabel = "\u689d\u4ef6\u7b26\u5408";
const conditionMatchedLabel = "\u7b26\u5408";
const conditionPendingLabel = "\u5f85\u78ba\u8a8d";
const conditionEmptyLabel = "\u5c1a\u672a\u547d\u4e2d";
const customRulesStorageKey = "house-hunter-custom-rules";
const activeBaseConditionsStorageKey = "house-hunter-active-base-conditions";

function toggleValue(values, value) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function createCustomRule() {
  return {
    ...defaultCustomRule,
    mode: "required",
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };
}

function createDraftRule() {
  return {
    label: "",
    type: "include",
    mode: "required",
    value: "",
  };
}

function loadCustomRules() {
  if (typeof window === "undefined") return [];

  try {
    const saved = window.localStorage.getItem(customRulesStorageKey);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function loadActiveBaseConditions() {
  if (typeof window === "undefined") return baseConditionLabels;

  try {
    const saved = window.localStorage.getItem(activeBaseConditionsStorageKey);
    if (!saved) return baseConditionLabels;

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed)
      ? parsed.filter((condition) => baseConditionLabels.includes(condition))
      : baseConditionLabels;
  } catch {
    return baseConditionLabels;
  }
}

export default function App() {
  const [query, setQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState(15000);
  const [selectedDistricts, setSelectedDistricts] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [onlyNew, setOnlyNew] = useState(false);
  const [sortKey, setSortKey] = useState("condition-fit");
  const [selectedListingId, setSelectedListingId] = useState("");
  const [activeBaseConditions, setActiveBaseConditions] = useState(loadActiveBaseConditions);
  const [customRules, setCustomRules] = useState(loadCustomRules);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [draftRule, setDraftRule] = useState(createDraftRule);
  const [refreshNote, setRefreshNote] = useState("");

  useEffect(() => {
    window.localStorage.setItem(customRulesStorageKey, JSON.stringify(customRules));
  }, [customRules]);

  useEffect(() => {
    window.localStorage.setItem(
      activeBaseConditionsStorageKey,
      JSON.stringify(activeBaseConditions),
    );
  }, [activeBaseConditions]);

  const stats = useMemo(() => getStats(listings), []);
  const visibleListings = useMemo(() => {
    const filtered = applyFilters(listings, {
      districts: selectedDistricts,
      maxPrice,
      sources: selectedSources,
      onlyNew,
      query,
    });
    return sortListings(
      applyCustomConditions(filtered, customRules, { activeBaseConditions }),
      sortKey,
    );
  }, [
    activeBaseConditions,
    customRules,
    maxPrice,
    onlyNew,
    query,
    selectedDistricts,
    selectedSources,
    sortKey,
  ]);

  const selectedListing =
    visibleListings.find((listing) => listing.id === selectedListingId) || visibleListings[0] || null;
  const visibleStats = getStats(visibleListings);

  function updateCustomRule(id, patch) {
    setCustomRules((rules) =>
      rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    );
  }

  function toggleBaseCondition(condition) {
    setActiveBaseConditions((conditions) => toggleValue(conditions, condition));
  }

  function addDraftRule() {
    const label = draftRule.label.trim();
    if (!label) return;

    setCustomRules((rules) => [
      ...rules,
      {
        ...createCustomRule(),
        ...draftRule,
        label,
        value: draftRule.value.trim(),
      },
    ]);
    setDraftRule(createDraftRule());
    setIsAddingRule(false);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Home size={20} strokeWidth={2.4} />
          </span>
          <div>
            <h1>房子獵人</h1>
            <p>雙北套房快篩表</p>
          </div>
        </div>
        <div className="top-actions">
          <span className="updated">更新：{updatedAt}</span>
          <button
            className="icon-button"
            title="每日更新資料"
            onClick={() => setRefreshNote("每日更新已排程；目前顯示最近一次搜尋結果。")}
          >
            <RefreshCw size={17} />
            更新資料
          </button>
        </div>
      </header>
      {refreshNote && <div className="notice">{refreshNote}</div>}

      <section className="summary-band" aria-label="搜尋統計">
        <Stat label="符合筆數" value={stats.total} />
        <Stat label="目前顯示" value={visibleStats.total} />
        <Stat label="新上架" value={stats.newCount} />
        <Stat label="最低價" value={stats.lowest?.priceText || "-"} />
      </section>

      <div className="workspace">
        <aside className="filters" aria-label="搜尋條件">
          <label className="search-box">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋標題、捷運、區域"
            />
          </label>

          <section>
            <div className="filter-head">
              <span>月租上限</span>
              <strong>{Number(maxPrice).toLocaleString("zh-TW")} 元</strong>
            </div>
            <input
              className="slider"
              type="range"
              min="7000"
              max="15000"
              step="500"
              value={maxPrice}
              onChange={(event) => setMaxPrice(Number(event.target.value))}
            />
          </section>

          <section>
            <div className="filter-head">
              <span>區域</span>
              <button onClick={() => setSelectedDistricts([])}>清除</button>
            </div>
            <div className="chip-grid">
              {districts.map((district) => (
                <button
                  className={selectedDistricts.includes(district) ? "chip active" : "chip"}
                  key={district}
                  onClick={() => setSelectedDistricts(toggleValue(selectedDistricts, district))}
                >
                  {district}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="filter-head">
              <span>來源</span>
            </div>
            <div className="segmented">
              {sources.map((source) => (
                <button
                  className={selectedSources.includes(source) ? "active" : ""}
                  key={source}
                  onClick={() => setSelectedSources(toggleValue(selectedSources, source))}
                >
                  {source}
                </button>
              ))}
            </div>
          </section>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={onlyNew}
              onChange={(event) => setOnlyNew(event.target.checked)}
            />
            只看新上架
          </label>

          <section className="custom-rules">
            <div className="filter-head">
              <span>我的條件</span>
              <button onClick={() => setActiveBaseConditions(baseConditionLabels)}>重設9個</button>
            </div>
            <div className="condition-checklist">
              {baseConditionLabels.map((condition) => (
                <label
                  className={
                    activeBaseConditions.includes(condition)
                      ? "condition-choice active"
                      : "condition-choice"
                  }
                  key={condition}
                >
                  <input
                    checked={activeBaseConditions.includes(condition)}
                    onChange={() => toggleBaseCondition(condition)}
                    type="checkbox"
                  />
                  <span>{condition}</span>
                </label>
              ))}
              {customRules
                .filter((rule) => rule.label.trim())
                .map((rule) => (
                  <span
                    className={
                      rule.enabled !== false
                        ? "condition-choice custom-condition active"
                        : "condition-choice custom-condition"
                    }
                    key={rule.id}
                  >
                    <label>
                      <input
                        checked={rule.enabled !== false}
                        onChange={(event) =>
                          updateCustomRule(rule.id, { enabled: event.target.checked })
                        }
                        type="checkbox"
                      />
                      <span>{rule.label}</span>
                    </label>
                    <button
                      aria-label={`刪除${rule.label}`}
                      className="inline-delete"
                      title="刪除條件"
                      onClick={() =>
                        setCustomRules((rules) => rules.filter((item) => item.id !== rule.id))
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                ))}
            </div>

            <div className="filter-head custom-rule-head">
              <span>自訂條件</span>
              <button onClick={() => setIsAddingRule((isAdding) => !isAdding)}>
                <Plus size={14} />
                新增
              </button>
            </div>
            {isAddingRule && (
              <div className="add-rule-form">
                  <input
                    aria-label="新增條件名稱"
                    value={draftRule.label}
                    onChange={(event) =>
                      setDraftRule((rule) => ({ ...rule, label: event.target.value }))
                    }
                    placeholder="例如：可貓"
                  />
                  <div className="add-rule-controls">
                    <select
                      aria-label="新增條件類型"
                      value={draftRule.type}
                      onChange={(event) =>
                        setDraftRule((rule) => ({ ...rule, type: event.target.value }))
                      }
                    >
                      <option value="include">包含</option>
                      <option value="exclude">排除</option>
                    </select>
                    <select
                      aria-label="新增條件模式"
                      value={draftRule.mode}
                      onChange={(event) =>
                        setDraftRule((rule) => ({ ...rule, mode: event.target.value }))
                      }
                    >
                      <option value="bonus">加分</option>
                      <option value="required">必要</option>
                    </select>
                    <button
                      aria-label="加入自訂條件"
                      className="add-rule-button"
                      onClick={addDraftRule}
                    >
                      加入
                    </button>
                  </div>
                  <input
                    aria-label="新增條件關鍵字"
                    value={draftRule.value}
                    onChange={(event) =>
                      setDraftRule((rule) => ({ ...rule, value: event.target.value }))
                    }
                    placeholder="不填就用條件名稱"
                  />
              </div>
            )}
            {customRules.filter((rule) => rule.label.trim()).length === 0 && !isAddingRule && (
              <p className="custom-empty">尚未加入自訂條件</p>
            )}
          </section>
        </aside>

        <section className="results">
          <div className="toolbar">
            <div>
              <h2>出租套房清單</h2>
              <p>{formatDistrictSummary(visibleStats.byDistrict) || "沒有符合條件的物件"}</p>
            </div>
            <label className="sort-control">
              <ArrowDownUp size={16} />
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
                <option value="condition-fit">{conditionSortLabel}</option>
                <option value="new-first">新上架優先</option>
                <option value="price-asc">價格低到高</option>
                <option value="price-desc">價格高到低</option>
                <option value="district">區域排序</option>
              </select>
            </label>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>區域</th>
                  <th>價格</th>
                  <th>標題</th>
                  <th>坪數</th>
                  <th>捷運站</th>
                  <th>來源</th>
                  <th>{conditionColumnLabel}</th>
                  <th>連結</th>
                </tr>
              </thead>
              <tbody>
                {visibleListings.map((listing) => (
                  <tr
                    className={selectedListing?.id === listing.id ? "selected-row" : ""}
                    key={listing.id}
                    onClick={() => setSelectedListingId(listing.id)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedListingId(listing.id);
                      }
                    }}
                  >
                    <td>{listing.district}</td>
                    <td className="price">{listing.priceText}</td>
                    <td>
                      <div className="title-cell">
                        {listing.isNew && <span className="new-dot">新</span>}
                        <span>{listing.title}</span>
                      </div>
                      <CompactConditionTags listing={listing} />
                    </td>
                    <td>{listing.area || "-"}</td>
                    <td>{listing.metro || "-"}</td>
                    <td>
                      <span className={`source source-${listing.source.toLowerCase()}`}>
                        {listing.source}
                      </span>
                    </td>
                    <td>
                      <ConditionScore listing={listing} />
                    </td>
                    <td>
                      <a
                        className="open-link"
                        href={listing.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <ExternalLink size={15} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="detail" aria-label="推薦物件">
          {selectedListing ? (
            <>
              <div className="detail-icon">
                <Sparkles size={20} />
              </div>
              <p className="detail-label">目前排序首選</p>
              <h3>{selectedListing.title}</h3>
              <div className="detail-price">{selectedListing.priceText}</div>
              <dl>
                <div>
                  <dt>區域</dt>
                  <dd>{selectedListing.district}</dd>
                </div>
                <div>
                  <dt>坪數</dt>
                  <dd>{selectedListing.area || "-"}</dd>
                </div>
                <div>
                  <dt>捷運</dt>
                  <dd>{selectedListing.metro || "-"}</dd>
                </div>
                <div>
                  <dt>來源</dt>
                  <dd>{selectedListing.source}</dd>
                </div>
                              <div>
                  <dt>{conditionMatchLabel}</dt>
                  <dd>
                    {selectedListing.conditionScore || 0}/{getConditionTotal(selectedListing)}
                  </dd>
                </div>
              </dl>
              <ConditionTags listing={selectedListing} />
              <a className="primary-link" href={selectedListing.url} target="_blank" rel="noreferrer">
                打開物件
                <ExternalLink size={16} />
              </a>
            </>
          ) : (
            <div className="empty-state">
              <Bell size={22} />
              <h3>沒有符合條件的房源</h3>
              <p>放寬價格或取消部分區域篩選，再試一次。</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function ConditionScore({ listing }) {
  const score = listing.conditionScore || 0;
  return (
    <span className={score >= 8 ? "condition-score strong" : "condition-score"}>
      {score}/{getConditionTotal(listing)}
    </span>
  );
}

function getConditionTotal(listing) {
  const matched = listing.matchedConditions || [];
  const missing = (listing.missingConditions || []).filter(
    (condition) => condition !== "詳情頁讀取失敗",
  );
  return matched.length + missing.length;
}

function CompactConditionTags({ listing }) {
  const matched = listing.matchedConditions || [];
  const missing = listing.missingConditions || [];
  const visibleMatched = matched.slice(0, 4);

  return (
    <div className="compact-conditions">
      {visibleMatched.map((condition) => (
        <span className="compact-condition matched" key={condition}>
          {condition}
        </span>
      ))}
      {matched.length > visibleMatched.length && (
        <span className="compact-condition muted">+{matched.length - visibleMatched.length}</span>
      )}
      {missing.length > 0 && (
        <span className="compact-condition pending">
          {conditionPendingLabel} {missing.length}
        </span>
      )}
    </div>
  );
}

function ConditionTags({ listing }) {
  const matched = listing.matchedConditions || [];
  const missing = listing.missingConditions || [];

  return (
    <div className="condition-panel">
      <div>
        <span className="condition-title">{conditionMatchedLabel}</span>
        <div className="condition-tags">
          {matched.length ? (
            matched.map((condition) => (
              <span className="condition-tag matched" key={condition}>
                {condition}
              </span>
            ))
          ) : (
            <span className="condition-tag muted">{conditionEmptyLabel}</span>
          )}
        </div>
      </div>
      <div>
        <span className="condition-title">{conditionPendingLabel}</span>
        <div className="condition-tags">
          {missing.map((condition) => (
            <span className="condition-tag missing" key={condition}>
              {condition}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
