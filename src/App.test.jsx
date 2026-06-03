// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import App from "./App.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("App", () => {
  it("renders the interactive dashboard into the root element", async () => {
    const rootElement = document.createElement("div");
    document.body.appendChild(rootElement);

    await act(async () => {
      createRoot(rootElement).render(<App />);
    });

    expect(rootElement.textContent).toContain("出租套房清單");
    expect(rootElement.querySelector("input")?.placeholder).toBe("搜尋標題、捷運、區域");
    expect(rootElement.textContent).toContain("南港區");
    expect(rootElement.textContent).toContain("文山區");
    expect(rootElement.textContent).toContain("松山區");
  });
});
