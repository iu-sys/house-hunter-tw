import { describe, expect, it } from "vitest";
import { normalizeExecOutput } from "./deploy-pages.mjs";

describe("deploy-pages script", () => {
  it("handles inherited stdio commands that return null output", () => {
    expect(normalizeExecOutput(null)).toBe("");
  });

  it("trims captured command output", () => {
    expect(normalizeExecOutput(" main\n")).toBe("main");
  });
});
