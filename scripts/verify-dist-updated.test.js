import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { verifyBuiltFrontendContainsUpdatedAt } from "./verify-dist-updated.mjs";

const tempDirs = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "house-hunter-dist-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("verifyBuiltFrontendContainsUpdatedAt", () => {
  it("passes when a built asset contains the current updatedAt string", async () => {
    const dir = await makeTempDir();
    await fs.mkdir(path.join(dir, "assets"), { recursive: true });
    await fs.writeFile(path.join(dir, "assets", "index-test.js"), 'const updated = "2026-06-25 02:50";');

    await expect(
      verifyBuiltFrontendContainsUpdatedAt({
        distDir: dir,
        updatedAt: "2026-06-25 02:50",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        assetPath: expect.stringContaining("index-test.js"),
      }),
    );
  });

  it("fails when no built asset contains the current updatedAt string", async () => {
    const dir = await makeTempDir();
    await fs.mkdir(path.join(dir, "assets"), { recursive: true });
    await fs.writeFile(path.join(dir, "assets", "index-test.js"), 'const updated = "2026-06-14 19:38";');

    await expect(
      verifyBuiltFrontendContainsUpdatedAt({
        distDir: dir,
        updatedAt: "2026-06-25 02:50",
      }),
    ).rejects.toThrow(/2026-06-25 02:50/);
  });
});
