// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App.jsx";
import { updatedAt } from "./data/listings.js";

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
