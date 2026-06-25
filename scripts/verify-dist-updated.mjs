import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { updatedAt } from "../src/data/listings.js";

export async function verifyBuiltFrontendContainsUpdatedAt({
  distDir = path.resolve("dist"),
  updatedAt: expectedUpdatedAt = updatedAt,
} = {}) {
  const assetsDir = path.join(distDir, "assets");
  const assetNames = await fs.readdir(assetsDir);
  const scriptNames = assetNames.filter((name) => /^index-.*\.js$/.test(name));

  for (const scriptName of scriptNames) {
    const assetPath = path.join(assetsDir, scriptName);
    const assetContents = await fs.readFile(assetPath, "utf8");

    if (assetContents.includes(expectedUpdatedAt)) {
      return { assetPath, updatedAt: expectedUpdatedAt };
    }
  }

  throw new Error(
    `Built frontend in ${distDir} does not contain updatedAt ${expectedUpdatedAt}.`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = await verifyBuiltFrontendContainsUpdatedAt();
  console.log(`Verified built frontend timestamp in ${result.assetPath}.`);
}
