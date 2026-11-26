# GPUFlow documentation

Source of [docs.gpuflow.app](https://docs.gpuflow.app), the documentation for [GPUFlow](https://gpuflow.app): rent a GPU by the hour through an OpenAI-compatible API, or rent out your own.

Built with [Astro Starlight](https://starlight.astro.build) and deployed by Cloudflare Pages on every push to `main`.

## Languages

All pages exist in 13 languages. English is at the root of `src/content/docs/`; every other language has its own folder (`de/`, `es/`, `fr/`, `ja/`, `ko/`, `zh-cn/`, `zh-tw/`, `pt-br/`, `ru/`, `he/`, `ar/`, `hi/`) with the same files and the same section order. Keep the languages in step with the app's `app/i18n.ts`.

## Numbers come from the app

Fees, holds, top-up limits, rating windows, points, levels and name rules are never typed into a page. Pages write a token such as `%earnings.holdDays%` or `%credits.topupMaxUsd%`, and the build fills it from `https://gpuflow.app/api/limits.json` (`src/lib/limits.mjs`). The build fails if that file can't be fetched or a token doesn't exist, and Cloudflare Pages then keeps the last good build.

- Money keys (ending in `Usd`) print as `$500` or `$2.50`. Point changes print with their sign.
- Tokens work in page text, titles, descriptions and sidebar labels, not inside code.
- To build against a local app: `LIMITS_URL=http://localhost:3000/api/limits.json pnpm build`.

## Help text for the app

The app's ⓘ buttons show docs text. A paragraph wrapped in `<Tip id="...">` (`src/components/Tip.astro`) is copied at build time into `/tips/<lang>.json`, with a link to its section. Use the same ids in every language: the build fails if a language is missing a tip that English has.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Local dev server at `localhost:4321` |
| `pnpm build` | Build the site to `./dist/` |
| `pnpm preview` | Serve the built site |
