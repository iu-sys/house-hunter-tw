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
});
