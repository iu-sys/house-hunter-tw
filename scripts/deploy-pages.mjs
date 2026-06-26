import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pageUrl = "https://iu-sys.github.io/house-hunter-tw/";

export function normalizeExecOutput(output) {
  return typeof output === "string" ? output.trim() : "";
}

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    encoding: "utf8",
    stdio: options.stdio || "pipe",
  });

  return normalizeExecOutput(output);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

export function publishPages() {
  const branch = run("git", ["branch", "--show-current"]);
  if (branch !== "main") {
    fail(`GitHub Pages publishes from main; current branch is ${branch || "(detached)"}.`);
  }

  const status = run("git", ["status", "--porcelain"]);
  if (status) {
    fail(
      [
        "Refusing to publish with uncommitted changes.",
        "Commit the update first so GitHub Pages can deploy the exact build inputs.",
        status,
      ].join("\n"),
    );
  }

  console.log(`Publishing ${pageUrl} by pushing main to origin...`);
  run("git", ["push", "origin", "main"], { stdio: "inherit" });
  console.log(`GitHub Pages workflow triggered for ${pageUrl}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  publishPages();
}
