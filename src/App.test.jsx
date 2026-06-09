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

function changeSelect(select, value) {
  const valueSetter = Object.getOwnPropertyDescriptor(select.constructor.prototype, "value")?.set;
  act(() => {
    valueSetter?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
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

    expect(document.body.textContent).toContain("Facebook");

    const choices = [...document.querySelectorAll(".condition-choice")];
    expect(choices).toHaveLength(9);
    expect(choices.every((choice) => choice.querySelector("input").checked)).toBe(true);

    const rentSubsidyChoice = choices.find((choice) => choice.textContent.includes("有租補"));
    click(rentSubsidyChoice.querySelector("input"));

    expect(document.querySelector(".condition-panel").textContent).not.toContain("有租補");
    expect(document.querySelector(".detail").textContent).toContain("8/8");
  });

  it("adds custom conditions into the main condition checklist", () => {
    renderApp();

    const addButton = [...document.querySelectorAll("button")].find(
      (button) => button.textContent.trim() === "新增",
    );
    click(addButton);

    const form = document.querySelector(".add-rule-form");
    changeInput(form.querySelector('input[aria-label="新增條件名稱"]'), "可貓");
    click(form.querySelector('button[aria-label="加入自訂條件"]'));

    const choices = [...document.querySelectorAll(".condition-choice")];
    expect(choices).toHaveLength(10);
    expect(choices.at(-1).textContent).toContain("可貓");
    expect(choices.at(-1).querySelector("input").checked).toBe(true);
    expect(document.querySelector(".custom-rule")).toBeNull();

    expect(localStorage.getItem("house-hunter-custom-rules")).toContain("可貓");
  });

  it("uses a custom condition name as an active required filter when keywords are blank", () => {
    renderApp();

    const addButton = [...document.querySelectorAll("button")].find(
      (button) => button.textContent.trim() === "新增",
    );
    click(addButton);

    const form = document.querySelector(".add-rule-form");
    changeInput(form.querySelector('input[aria-label="新增條件名稱"]'), "可貓");
    changeSelect(form.querySelector('select[aria-label="新增條件模式"]'), "required");
    click(form.querySelector('button[aria-label="加入自訂條件"]'));

    expect(document.querySelector(".detail").textContent).toContain("可貓");
    expect(document.querySelector("tbody").textContent).toContain("可貓");
  });
});
