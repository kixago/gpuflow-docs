// src/lib/limits.mjs
//
// The app's limits (fees, holds, top-up limits, rating windows, points,
// levels, name rules), fetched once per build from gpuflow.app/api/limits.json
// so the docs can't state a number the app doesn't enforce. Pages write
// %group.key% (for example %earnings.holdDays%) and fill() puts the value in.
// The build fails if the file can't be fetched or a key doesn't exist:
// Cloudflare Pages then keeps serving the last good build.
//
// LIMITS_URL points the build at another copy (a local app, for testing).
const URL_ = process.env.LIMITS_URL ?? "https://gpuflow.app/api/limits.json";

async function load() {
  const res = await fetch(URL_, {
    headers: { "user-agent": "gpuflow-docs-build" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`limits: ${URL_} answered HTTP ${res.status}`);
  return res.json();
}

export const limits = await load();

const flat = new Map();
(function walk(node, path) {
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
  } else {
    flat.set(path, node);
  }
})(limits, "");

// Points that move a total up or down are shown with their sign.
const SIGNED = /^points\.(ratingGiven|stars\d|thumbsUp|thumbsDown|onlineWholeRental|machineOffline|reviewHidden|cardDispute)$/;

export function value(key) {
  if (!flat.has(key)) throw new Error(`limits: no value "${key}" in ${URL_}`);
  const v = flat.get(key);
  if (typeof v !== "number") return String(v);
  if (key.endsWith("Usd")) {
    return `$${Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(2)}`;
  }
  const n = Math.abs(v).toLocaleString("en-US");
  // Signs stay left to right (U+2066 ... U+2069), so "+10" doesn't turn into
  // "10+" on Hebrew and Arabic pages.
  const ltr = (t) => `⁦${t}⁩`;
  if (SIGNED.test(key)) return v > 0 ? ltr(`+${n}`) : v < 0 ? ltr(`−${n}`) : "0";
  return v < 0 ? ltr(`−${n}`) : n;
}

export const TOKEN = /%([a-z]+\.[a-zA-Z0-9.]+)%/g;
export const fill = (text) =>
  typeof text === "string" ? text.replace(TOKEN, (_, key) => value(key)) : text;
