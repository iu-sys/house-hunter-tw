import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publishPages } from "./deploy-pages.mjs";

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: options.stdio || "inherit",
  });
}

export function normalizeLines(output) {
  return String(output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function buildRefreshCommitMessage(
  now = new Date(),
  timeZone = process.env.REFRESH_TIME_ZONE || "Asia/Taipei",
) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(now)
    .reduce((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});
  const year = parts.year;
  const month = parts.month;
  const day = parts.day;
  return `chore: refresh rental listings ${year}-${month}-${day}`;
}

export function getTrackedChanges() {
  return normalizeLines(run("git", ["status", "--short"], { stdio: "pipe" }));
}

export function refreshSite() {
  run("npm", ["run", "update:data"]);
  run("npm", ["test"]);
  run("npm", ["run", "build"]);
  run("npm", ["audit", "--json"]);

  const trackedChanges = getTrackedChanges();
  if (trackedChanges.length > 0) {
    run("git", ["add", "src/data/listings.js", "scripts/update-data.mjs"]);

    const stagedChanges = getTrackedChanges();
    if (stagedChanges.length > 0) {
      const commitMessage = process.env.REFRESH_COMMIT_MESSAGE || buildRefreshCommitMessage();
      run("git", ["commit", "-m", commitMessage]);
    }
  }

  publishPages();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  refreshSite();
}
