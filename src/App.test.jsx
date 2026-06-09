// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App.jsx";

let root;

function renderApp() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<App />);
  });
}

function click(element) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function changeInput(input, value) {
  const valueSetter = Object.getOwnPropertyDescriptor(input.constructor.prototype, "value")?.set;
  act(() => {
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("App condition controls", () => {
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

  it("renders the 9 default condition choices and updates the detail tags when one is unchecked", () => {
    renderApp();

    const choices = [...document.querySelectorAll(".condition-choice")];
    expect(choices).toHaveLength(9);
    expect(choices.every((choice) => choice.querySelector("input").checked)).toBe(true);

    const rentSubsidyChoice = choices.find((choice) => choice.textContent.includes("有租補"));
    click(rentSubsidyChoice.querySelector("input"));

    expect(document.querySelector(".condition-panel").textContent).not.toContain("有租補");
    expect(document.querySelector(".detail").textContent).toContain("8/8");
  });

  it("adds custom condition rows that are enabled by default and stored for reuse", () => {
    renderApp();

    const addButton = [...document.querySelectorAll("button")].find(
      (button) => button.textContent.trim() === "新增",
    );
    click(addButton);

    const customRule = document.querySelector(".custom-rule");
    expect(customRule.querySelector(".rule-enabled input").checked).toBe(true);

    changeInput(customRule.querySelector('input[aria-label="條件名稱"]'), "可貓");
    changeInput(customRule.querySelector('input[aria-label="關鍵字"]'), "可貓");

    expect(localStorage.getItem("house-hunter-custom-rules")).toContain("可貓");
  });
});
