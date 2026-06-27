import { describe, expect, it } from "vitest";
import { buildRefreshCommitMessage, normalizeLines } from "./refresh-site.mjs";

describe("refresh-site script", () => {
  it("formats the default refresh commit message with the local date", () => {
    expect(buildRefreshCommitMessage(new Date("2026-06-28T02:27:00+08:00"))).toBe(
      "chore: refresh rental listings 2026-06-28",
    );
  });

  it("normalizes git status output into trimmed lines", () => {
    expect(normalizeLines(" M src/data/listings.js\r\n M scripts/update-data.mjs\r\n")).toEqual([
      "M src/data/listings.js",
      "M scripts/update-data.mjs",
    ]);
  });
});
