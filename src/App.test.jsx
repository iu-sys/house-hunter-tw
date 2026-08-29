// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import { updatedAt } from "./data/listings.js";

const mockListings = vi.hoisted(() =>
  [
    {
      source: "591",
      district: "板橋區",
      price: 12000,
      priceText: "12,000元/月",
      title: "Alpha suite",
      area: "6坪",
      metro: "新埔",
      sourceUrl: "https://rent.591.com.tw/1001",
      url: "https://rent.591.com.tw/1001",
      imageUrl: "https://example.com/alpha.jpg",
      isNew: true,
      matchedConditions: ["對外窗"],
      missingConditions: [],
      searchText: "Alpha suite detail",
    },
    {
      source: "591",
      district: "中和區",
      price: 13000,
      priceText: "13,000元/月",
      title: "Top \u9802\u6a13\u52a0\u84cb studio",
      area: "7坪",
      metro: "景安",
      sourceUrl: "https://rent.591.com.tw/1002",
      url: "https://rent.591.com.tw/1002",
      isNew: false,
      matchedConditions: ["對外窗"],
      missingConditions: [],
      searchText: "Top floor addition detail",
    },
    {
      source: "591",
      district: "三重區",
      price: 11000,
      priceText: "11,000元/月",
      title: "Hidden detail suite",
      area: "5坪",
      metro: "台北橋",
      sourceUrl: "https://rent.591.com.tw/1003",
      url: "https://rent.591.com.tw/1003",
      isNew: false,
      matchedConditions: ["對外窗"],
      missingConditions: [],
      searchText: "\u4e00\u5ea66\u584a only appears in hidden detail",
    },
  ].map((listing, index) => ({
    ...listing,
    id: `${listing.source}-${index + 1}`,
    conditionScore: listing.matchedConditions.length,
  })),
);

vi.mock("./data/listings.js", () => ({
  updatedAt: "2026-07-08 04:21",
  listings: mockListings,
}));

let root;

function renderApp() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<App />);
  });
}

function setInputValue(input, value) {
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  valueSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = undefined;
  });

  it("renders source toggles and listing rows", () => {
    renderApp();

    const sourceButtons = [...document.querySelectorAll(".segmented button")].map((button) =>
      button.textContent.trim(),
    );

    expect(sourceButtons).toEqual(expect.arrayContaining(["591", "PTT"]));
    expect(document.querySelectorAll("tbody tr").length).toBeGreaterThan(0);
  });

  it("shows the generated updated timestamp", () => {
    renderApp();

    expect(document.querySelector(".updated").textContent).toContain(updatedAt);
  });

  it("updates the detail panel when selecting a different listing row", () => {
    renderApp();

    const rows = [...document.querySelectorAll("tbody tr")];
    expect(rows.length).toBeGreaterThan(1);

    const firstTitle = rows[0].querySelector(".title-cell span:last-child").textContent;
    const secondTitle = rows[1].querySelector(".title-cell span:last-child").textContent;
    expect(firstTitle).not.toBe(secondTitle);

    expect(document.querySelector(".detail h3").textContent).toBe(firstTitle);
    act(() => {
      rows[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.querySelector(".detail h3").textContent).toBe(secondTitle);
  });

  it("renders 591 entries as original listing href links", () => {
    renderApp();

    const firstRowAction = document.querySelector("tbody tr .open-link");
    expect(firstRowAction.tagName).toBe("A");
    expect(firstRowAction.getAttribute("href")).toMatch(/^https:\/\/rent\.591\.com\.tw\/\d+/);

    const detailAction = document.querySelector(".detail .primary-link");
    expect(detailAction.tagName).toBe("A");
    expect(detailAction.getAttribute("href")).toBe(firstRowAction.getAttribute("href"));
    expect(detailAction.textContent).toContain("打開物件");
  });

  it("shows the selected listing thumbnail in the detail panel", () => {
    renderApp();

    const alphaRow = [...document.querySelectorAll("tbody tr")].find((row) =>
      row.textContent.includes("Alpha suite"),
    );
    expect(alphaRow).toBeTruthy();

    act(() => {
      alphaRow.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const thumbnail = document.querySelector('.detail img[alt="Alpha suite"]');

    expect(thumbnail).toBeTruthy();
    expect(thumbnail.getAttribute("src")).toBe("https://example.com/alpha.jpg");
  });

  it("filters listings from a typed monthly rent range", () => {
    renderApp();

    const minPriceInput = document.querySelector('input[aria-label="最低租金"]');
    const maxPriceInput = document.querySelector('input[aria-label="最高租金"]');

    expect(minPriceInput).toBeTruthy();
    expect(maxPriceInput).toBeTruthy();

    act(() => {
      setInputValue(minPriceInput, "11500");
      setInputValue(maxPriceInput, "12500");
    });

    const visibleTitles = [...document.querySelectorAll("tbody tr .title-cell span:last-child")].map(
      (title) => title.textContent,
    );

    expect(visibleTitles).toEqual(["Alpha suite"]);
  });

  it("adds a do-not-show keyword filter that removes matching listings", () => {
    renderApp();

    const firstTitle = document.querySelector("tbody tr .title-cell span:last-child").textContent;
    const initialRowCount = document.querySelectorAll("tbody tr").length;
    const excludeInput = document.querySelector('input[aria-label="不要出現關鍵字"]');

    expect(excludeInput).toBeTruthy();
    act(() => {
      setInputValue(excludeInput, firstTitle);
      document.querySelector('button[aria-label="新增排除條件"]').click();
    });

    const visibleTitles = [...document.querySelectorAll("tbody tr .title-cell span:last-child")].map(
      (title) => title.textContent,
    );
    const savedRules = JSON.parse(localStorage.getItem("house-hunter-custom-rules"));

    expect(document.querySelectorAll("tbody tr").length).toBeLessThan(initialRowCount);
    expect(visibleTitles).not.toContain(firstTitle);
    expect(savedRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: `不要 ${firstTitle}`,
          type: "exclude",
          mode: "required",
          value: firstTitle,
        }),
      ]),
    );
  });

  it("filters top-floor addition listings when typing the long phrase", () => {
    renderApp();

    const initialRows = [...document.querySelectorAll("tbody tr")];
    const initialTopFloorRows = initialRows.filter((row) => {
      const title = row.querySelector(".title-cell span:last-child").textContent;
      return title.includes("頂加") || title.includes("頂樓加蓋");
    });
    const excludeInput = document.querySelector('input[aria-label="不要出現關鍵字"]');

    expect(initialTopFloorRows.length).toBeGreaterThan(0);
    act(() => {
      setInputValue(excludeInput, "頂樓加蓋");
      document.querySelector('button[aria-label="新增排除條件"]').click();
    });

    const remainingTopFloorRows = [...document.querySelectorAll("tbody tr")].filter((row) => {
      const title = row.querySelector(".title-cell span:last-child").textContent;
      return title.includes("頂加") || title.includes("頂樓加蓋");
    });

    expect(remainingTopFloorRows).toEqual([]);
    expect(document.querySelector("tbody").textContent).not.toContain("不要頂樓加蓋");
  });

  it("filters listings by hidden detail search text", () => {
    renderApp();

    const initialRowCount = document.querySelectorAll("tbody tr").length;
    const excludeInput = document.querySelector('input[aria-label="不要出現關鍵字"]');

    act(() => {
      setInputValue(excludeInput, "一度6塊");
      document.querySelector('button[aria-label="新增排除條件"]').click();
    });

    expect(document.querySelectorAll("tbody tr").length).toBeLessThan(initialRowCount);
  });
});
