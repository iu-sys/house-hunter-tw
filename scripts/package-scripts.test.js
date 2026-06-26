import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

describe("package scripts", () => {
  it("publishes the primary site through GitHub Pages", () => {
    expect(packageJson.scripts["deploy:pages"]).toBe("node scripts/deploy-pages.mjs");
    expect(packageJson.scripts.publish).toBe("npm run build && npm run deploy:pages");
    expect(packageJson.scripts.publish).not.toContain("netlify");
  });
});
