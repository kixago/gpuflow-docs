// Tell IndexNow search engines (Bing, Yandex, ...) which docs pages changed.
// Run after the push has deployed:
//   pnpm indexnow                 pages changed by the last commit
//   pnpm indexnow --all           every page in dist/sitemap-*.xml (after pnpm build)
//   pnpm indexnow <url>...        these URLs
// Add --dry-run to print the URLs without submitting them.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

const HOST = "docs.gpuflow.app";
const KEY = "d0d48b7d37b4401d911756d7ebade672";
const ENDPOINT = "https://api.indexnow.org/indexnow";

// https://www.indexnow.org/documentation
const STATUS = {
  200: "OK, URLs submitted",
  202: "Accepted, key validation pending",
  400: "Bad request, invalid format",
  403: "Forbidden, key not valid (key file missing or wrong)",
  422: "Unprocessable, URLs do not belong to the host or key does not match",
  429: "Too many requests, possible spam",
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const rest = args.filter((a) => a !== "--dry-run");

function fail(message) {
  console.error(message);
  process.exit(1);
}

// src/content/docs/de/providers/pricing.mdx -> https://docs.gpuflow.app/de/providers/pricing/
function pageUrl(file) {
  const slug = file.replace(/^src\/content\/docs\//, "").replace(/\.mdx?$/, "").replace(/(^|\/)index$/, "");
  return `https://${HOST}/${slug ? `${slug}/` : ""}`;
}

function changedInLastCommit() {
  let out;
  try {
    // --no-renames lists a rename as its deleted and added path, so both get submitted.
    out = execFileSync(
      "git",
      ["diff", "--name-only", "--no-renames", "HEAD~1", "HEAD", "--", "src/content/docs"],
      { encoding: "utf8" },
    );
  } catch {
    fail("git diff HEAD~1 failed. In a shallow clone, run `git fetch --deepen=1` first.");
  }
  return out.split("\n").filter((f) => /\.mdx?$/.test(f)).map(pageUrl);
}

function sitemapUrls() {
  let files;
  try {
    // sitemap-index.xml lists sitemaps, not pages.
    files = readdirSync("dist").filter((f) => /^sitemap-\d+\.xml$/.test(f));
  } catch {
    files = [];
  }
  if (!files.length) fail("No dist/sitemap-*.xml. Run `pnpm build` first.");
  return files.flatMap((f) =>
    [...readFileSync(`dist/${f}`, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]),
  );
}

let urls;
if (rest[0] === "--all") urls = sitemapUrls();
else if (rest.length) urls = rest;
else urls = changedInLastCommit();
urls = [...new Set(urls)];

const foreign = urls.filter((u) => !u.startsWith(`https://${HOST}/`));
if (foreign.length) fail(`Not on https://${HOST}/:\n${foreign.join("\n")}`);
if (!urls.length) {
  console.log("Nothing to submit.");
  process.exit(0);
}

console.log(urls.join("\n"));
if (dryRun) {
  console.log(`Dry run: ${urls.length} URL(s) not submitted.`);
  process.exit(0);
}

let res;
try {
  res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: `https://${HOST}/${KEY}.txt`,
      urlList: urls,
    }),
  });
} catch (err) {
  fail(`Request to ${ENDPOINT} failed: ${err.message}`);
}
const message = `${res.status} ${STATUS[res.status] ?? res.statusText}: ${urls.length} URL(s)`;
if (res.status !== 200 && res.status !== 202) fail(message);
console.log(message);
