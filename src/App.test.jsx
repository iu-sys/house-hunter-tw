// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import App from "./App.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function renderApp() {
  const rootElement = document.createElement("div");
  document.body.appendChild(rootElement);

  await act(async () => {
    createRoot(rootElement).render(<App />);
  });

  return rootElement;
}

describe("App", () => {
  it("renders the flight hunter dashboard with verified deal data", async () => {
    const rootElement = await renderApp();

    expect(rootElement.textContent).toContain("機票獵人");
    expect(rootElement.textContent).toContain("台北桃園 TPE");
    expect(rootElement.textContent).toContain("來回含行李 ≤ NT$10,000");
    expect(rootElement.textContent).toContain("釜山 PUS");
    expect(rootElement.textContent).toContain("沖繩 OKA");
  });

  it("shows a broader monitoring pool than the currently verified deals", async () => {
    const rootElement = await renderApp();

    expect(rootElement.textContent).toContain("酷航");
    expect(rootElement.textContent).toContain("濟州航空");
    expect(rootElement.textContent).toContain("真航空");
    expect(rootElement.textContent).toContain("德威航空");
    expect(rootElement.textContent).toContain("福岡 FUK");
    expect(rootElement.textContent).toContain("名古屋 NGO");
    expect(rootElement.textContent).toContain("札幌 CTS");
    expect(rootElement.textContent).toContain("濟州 CJU");
  });

  it("filters verified deals by airline while keeping the monitoring pool visible", async () => {
    const rootElement = await renderApp();
    const peachButton = [...rootElement.querySelectorAll("button")].find(
      (button) => button.textContent === "樂桃航空",
    );

    await act(async () => {
      peachButton.click();
    });

    const resultsText = rootElement.querySelector(".deal-board")?.textContent || "";
    expect(resultsText).toContain("大阪 KIX");
    expect(resultsText).toContain("東京 NRT/HND");
    expect(resultsText).not.toContain("釜山 PUS");
    expect(rootElement.textContent).toContain("德威航空");
  });
});
