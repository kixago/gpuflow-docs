// src/lib/tips-integration.mjs
//
// After the build: collects every <Tip> paragraph per language into
// dist/tips/<lang>.json ({ tips: { id: { text, url } } }) for the app's ⓘ
// buttons, and fails the build if a language is missing a tip English has
// (or has one English doesn't), so no ⓘ can go blank in one language. Also
// fills %group.key% tokens in the raw .md copies the page actions serve,
// which are written from the source, not through Markdown.
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { fill, TOKEN } from "./limits.mjs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SITE = "https://docs.gpuflow.app";
const TIP = /<div class="gpuflow-tip" id="([^"]+)" data-tip="([^"]+)">([\s\S]*?)<\/div>/g;
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", "#x27": "'", nbsp: " " };

const text = (html) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&(#?\w+);/g, (m, e) =>
      ENTITIES[e] ?? (e.startsWith("#x") ? String.fromCodePoint(parseInt(e.slice(2), 16)) : e.startsWith("#") ? String.fromCodePoint(Number(e.slice(1))) : m),
    )
    .replace(/\s+/g, " ")
    .trim();

async function* files(dir, test) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* files(p, test);
    else if (test(e.name)) yield p;
  }
}

export default function tipsIntegration(locales) {
  return {
    name: "gpuflow-tips",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const prefixes = Object.keys(locales).filter((k) => k !== "root");
        const byLang = new Map([["en", {}], ...prefixes.map((p) => [p, {}])]);
        for await (const file of files(root, (n) => n.endsWith(".md") || n.endsWith(".txt"))) {
          const raw = await readFile(file, "utf8");
          if (TOKEN.test(raw)) await writeFile(file, fill(raw));
          TOKEN.lastIndex = 0;
        }
        for await (const file of files(root, (n) => n === "index.html")) {
          const rel = path.relative(root, path.dirname(file)).split(path.sep).join("/");
          const first = rel.split("/")[0];
          const lang = prefixes.includes(first) ? first : "en";
          const html = await readFile(file, "utf8");
          for (const [, anchor, id, body] of html.matchAll(TIP)) {
            const tips = byLang.get(lang);
            if (tips[id]) throw new Error(`tips: "${id}" appears twice in ${lang}`);
            tips[id] = { text: text(body), url: `${SITE}/${rel ? `${rel}/` : ""}#${anchor}` };
          }
        }
        const english = Object.keys(byLang.get("en")).sort();
        const problems = [];
        for (const [lang, tips] of byLang) {
          const ids = Object.keys(tips).sort();
          const missing = english.filter((i) => !ids.includes(i));
          const extra = ids.filter((i) => !english.includes(i));
          if (missing.length || extra.length) {
            problems.push(`${lang}: missing ${missing.join(", ") || "none"}; extra ${extra.join(", ") || "none"}`);
          }
        }
        if (problems.length) throw new Error(`tips differ between languages:\n${problems.join("\n")}`);
        await mkdir(path.join(root, "tips"), { recursive: true });
        for (const [lang, tips] of byLang) {
          await writeFile(path.join(root, "tips", `${lang}.json`), `${JSON.stringify({ lang, tips })}\n`);
        }
        logger.info(`${english.length} tips written for ${byLang.size} languages`);
      },
    },
  };
}
