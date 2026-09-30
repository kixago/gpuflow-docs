// @ts-check
import starlight from "@astrojs/starlight";
import starlightPageActions from "starlight-page-actions";
import sitemap from "@astrojs/sitemap";
import starlightLlmsTxt from "starlight-llms-txt";
import { defineConfig } from "astro/config";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";

/**
 * @type {import('@astrojs/starlight/types').StarlightPlugin}
 */
const externalLinksPlugin = {
  name: "external-links",
  hooks: {
    "config:setup": ({ updateConfig }) => {
      updateConfig({
        head: [
          {
            tag: "script",
            content: `
                            function handleExternalLinks() {
                                const links = document.querySelectorAll('a');
                                links.forEach(link => {
                                    const href = link.getAttribute('href');
                                    if (href && 
                                        (href.startsWith('http://') || href.startsWith('https://')) &&
                                        !href.includes(window.location.hostname)) {
                                        link.setAttribute('target', '_blank');
                                        link.setAttribute('rel', 'noopener noreferrer');
                                    }
                                });
                            }
                            
                            if (document.readyState === 'loading') {
                                document.addEventListener('DOMContentLoaded', handleExternalLinks);
                            } else {
                                handleExternalLinks();
                            }
                            
                            // Handle navigation changes in SPAs
                            document.addEventListener('astro:page-load', handleExternalLinks);
                        `,
          },
        ],
      });
    },
  },
};

/**
 * @type {import('@astrojs/starlight/types').StarlightPlugin}
 */
const analyticsPlugin = {
  name: "docs-analytics",
  hooks: {
    "config:setup": ({ updateConfig }) => {
      // Only add analytics in production
      if (process.env.NODE_ENV === "production") {
        updateConfig({
          head: [
            {
              tag: "script",
              content: `
                                (function() {
                                    let ws = null;
                                    let authenticated = false;
                                    let pageStartTime = Date.now();
                                    let scrollDepth = 0;
                                    let clickCount = 0;
                                    let sessionStart = Date.now();
                                    
                                    function connectWebSocket() {
                                        if (ws && ws.readyState === WebSocket.OPEN) return;
                                        
                                        try {
                                            ws = new WebSocket('wss://ws.gpuflow.app/ws/client');
                                            
                                            ws.onopen = function() {
                                                const token = 'docs-anon-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8);
                                                ws.send(JSON.stringify({
                                                    type: 'authenticate',
                                                    data: token,
                                                    timestamp: Date.now()
                                                }));
                                            };
                                            
                                            ws.onmessage = function(event) {
                                                const msg = JSON.parse(event.data);
                                                if (msg.type === 'auth_success' && !authenticated) {
                                                    authenticated = true;
                                                    sendSessionStart();
                                                    sendPageVisit();
                                                    startHeartbeat();
                                                }
                                            };
                                            
                                            ws.onclose = function() {
                                                authenticated = false;
                                                setTimeout(connectWebSocket, 5000);
                                            };
                                            
                                            ws.onerror = function(error) {
                                                console.log('Docs analytics connection failed');
                                            };
                                            
                                        } catch (error) {
                                            console.error('Analytics error:', error);
                                        }
                                    }
                                    
                                    function sendMessage(type, data) {
                                        if (ws && ws.readyState === WebSocket.OPEN && authenticated) {
                                            ws.send(JSON.stringify({
                                                type: type,
                                                data: data,
                                                timestamp: Date.now()
                                            }));
                                        }
                                    }
                                    
                                    function sendSessionStart() {
                                        sendMessage('session_start', {
                                            site: 'docs',
                                            sessionStart: new Date(sessionStart).toISOString(),
                                            userAgent: navigator.userAgent,
                                            viewport: {
                                                width: window.innerWidth,
                                                height: window.innerHeight
                                            },
                                            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                                            language: navigator.language
                                        });
                                    }
                                    
                                    function sendPageVisit() {
                                        pageStartTime = Date.now();
                                        scrollDepth = 0;
                                        clickCount = 0;
                                        
                                        sendMessage('page_visit', {
                                            url: window.location.pathname + window.location.search,
                                            title: document.title,
                                            site: 'docs',
                                            referrer: document.referrer,
                                            userAgent: navigator.userAgent,
                                            viewport: {
                                                width: window.innerWidth,
                                                height: window.innerHeight
                                            }
                                        });
                                    }
                                    
                                    function sendPageLeave() {
                                        const timeOnPage = Date.now() - pageStartTime;
                                        sendMessage('page_leave', {
                                            url: window.location.pathname,
                                            duration: timeOnPage,
                                            maxScrollDepth: scrollDepth,
                                            clickEvents: clickCount,
                                            site: 'docs'
                                        });
                                    }
                                    
                                    function startHeartbeat() {
                                        setInterval(function() {
                                            if (authenticated) {
                                                const timeOnPage = Date.now() - pageStartTime;
                                                sendMessage('session_update', {
                                                    site: 'docs',
                                                    currentPage: window.location.pathname,
                                                    timeOnCurrentPage: timeOnPage,
                                                    scrollDepth: scrollDepth,
                                                    clickCount: clickCount,
                                                    sessionDuration: Date.now() - sessionStart
                                                });
                                            }
                                        }, 15000);
                                    }
                                    
                                    // Track scroll depth
                                    let scrollTimeout;
                                    window.addEventListener('scroll', function() {
                                        clearTimeout(scrollTimeout);
                                        scrollTimeout = setTimeout(function() {
                                            const scrollPercent = Math.round(
                                                (window.pageYOffset / (document.body.scrollHeight - window.innerHeight)) * 100
                                            );
                                            scrollDepth = Math.max(scrollDepth, scrollPercent || 0);
                                        }, 100);
                                    });
                                    
                                    // Track clicks and docs-specific interactions
                                    document.addEventListener('click', function(event) {
                                        clickCount++;
                                        
                                        const target = event.target;
                                        if (target && target.matches && target.matches('a[href]')) {
                                            const href = target.getAttribute('href');
                                            const isExternal = href && (href.startsWith('http://') || href.startsWith('https://')) && !href.includes('docs.gpuflow.app');
                                            
                                            sendMessage('docs_link_click', {
                                                href: href,
                                                text: target.textContent && target.textContent.trim().substring(0, 50) || '',
                                                isExternal: isExternal,
                                                section: getCurrentSection()
                                            });
                                        }
                                    });
                                    
                                    function getCurrentSection() {
                                        const pathParts = window.location.pathname.split('/').filter(Boolean);
                                        return pathParts[0] || 'home';
                                    }
                                    
                                    // Connect on page load
                                    connectWebSocket();
                                    
                                    // Track navigation changes
                                    let currentPath = window.location.pathname;
                                    function checkPathChange() {
                                        if (window.location.pathname !== currentPath) {
                                            sendPageLeave();
                                            currentPath = window.location.pathname;
                                            sendPageVisit();
                                        }
                                    }
                                    
                                    setInterval(checkPathChange, 1000);
                                    
                                    // Handle Astro page navigation
                                    document.addEventListener('astro:page-load', function() {
                                        setTimeout(function() {
                                            sendPageLeave();
                                            sendPageVisit();
                                        }, 100);
                                    });
                                    
                                    // Send page leave on unload
                                    window.addEventListener('beforeunload', function() {
                                        sendPageLeave();
                                    });
                                    
                                    // Handle visibility changes
                                    document.addEventListener('visibilitychange', function() {
                                        if (document.hidden) {
                                            sendPageLeave();
                                        }
                                    });
                                })();
                            `,
            },
          ],
        });
      }
    },
  },
};

// https://astro.build/config
//
// English lives at the root (/providers/...), every other language under its
// own prefix (/de/providers/...). The app links to the same prefix as the
// language the visitor is using. Keep LOCALES in step with the app's
// app/i18n.ts supportedLngs.
const LOCALES = {
  root: { label: "English", lang: "en" },
  de: { label: "Deutsch", lang: "de" },
  es: { label: "Español", lang: "es" },
  fr: { label: "Français", lang: "fr" },
  ja: { label: "日本語", lang: "ja" },
  ko: { label: "한국어", lang: "ko" },
  "zh-cn": { label: "简体中文", lang: "zh-CN" },
  "zh-tw": { label: "繁體中文", lang: "zh-TW" },
  "pt-br": { label: "Português (Brasil)", lang: "pt-BR" },
  ru: { label: "Русский", lang: "ru" },
  he: { label: "עברית", lang: "he", dir: "rtl" },
  ar: { label: "العربية", lang: "ar", dir: "rtl" },
  hi: { label: "हिन्दी", lang: "hi" },
};

const SIDEBAR_LABELS = {
  renters: {
    de: "GPU mieten", es: "Alquilar una GPU", fr: "Louer un GPU", ja: "GPU をレンタルする",
    ko: "GPU 대여하기", "zh-CN": "租用 GPU", "zh-TW": "租用 GPU", "pt-BR": "Alugar uma GPU",
    ru: "Аренда GPU", he: "שכירת GPU", ar: "استئجار وحدة GPU", hi: "GPU किराये पर लेना",
  },
  providers: {
    de: "GPU vermieten", es: "Ofrecer tu GPU", fr: "Proposer votre GPU", ja: "GPU を提供する",
    ko: "GPU 제공하기", "zh-CN": "提供 GPU", "zh-TW": "提供 GPU", "pt-BR": "Oferecer sua GPU",
    ru: "Сдача GPU в аренду", he: "השכרת ה-GPU שלכם", ar: "تأجير وحدة GPU الخاصة بك", hi: "अपना GPU किराये पर देना",
  },
};

// Old addresses that search engines and other sites still link to.
const REDIRECTS = {
  "/renters/how-to-rent-gpu": "/renters/getting-started/",
  "/renters/wallet-setup": "/renters/billing/",
  "/renters/access-methods": "/renters/api-quickstart/",
  "/renters/wireguard-client": "/renters/api-quickstart/",
  "/renters/use-cases": "/renters/api-quickstart/",
  "/providers/configuration/account-setup": "/providers/getting-started/",
  "/providers/configuration/creating-listings": "/providers/creating-listings/",
  "/providers/configuration/security-best-practices": "/providers/security/",
  "/providers/configuration/wallet-management": "/providers/getting-paid/",
  "/providers/configuration/windows-automation": "/providers/getting-started/",
  "/providers/installation/linux/nvidia": "/providers/getting-started/",
  "/providers/installation/linux/amd": "/providers/getting-started/",
  "/providers/installation/linux/container-runtime/podman-nvidia": "/providers/getting-started/",
  "/providers/installation/windows/nvidia": "/providers/getting-started/",
  "/providers/installation/windows/amd": "/providers/getting-started/",
  "/providers/networking/wireguard-p2p": "/providers/security/",
  "/providers/operations/performance-monitoring": "/providers/getting-started/",
  "/providers/monitoring-performance": "/providers/getting-started/",
  "/providers/optimization-tips": "/providers/pricing/",
  "/providers/renter-communications": "/providers/creating-listings/",
  "/providers/troubleshooting-linux": "/providers/troubleshooting/",
  "/providers/troubleshooting-windows": "/providers/troubleshooting/",
};

// A static build turns `redirects` into meta-refresh pages served with 200.
// Cloudflare Pages applies _redirects before static files, so these become
// real 301s; the pages stay as a fallback for other hosts.
const cloudflareRedirects = {
  name: "cloudflare-redirects",
  hooks: {
    "astro:build:done": async ({ dir }) => {
      const lines = Object.entries(REDIRECTS).flatMap(([from, to]) => [
        `${from} ${to} 301`,
        `${from}/ ${to} 301`,
      ]);
      await writeFile(new URL("_redirects", dir), `${lines.join("\n")}\n`);
    },
  },
};

// Last commit date of each docs page, keyed by URL path, for the sitemap's
// <lastmod>. A shallow clone (Cloudflare Pages' default) has only the newest
// commit and would date every page to it, so give no dates rather than wrong ones.
function docsLastModified() {
  const git = (...args) =>
    execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const dates = new Map();
  try {
    if (git("rev-parse", "--is-shallow-repository").trim() !== "false") return dates;
    let date;
    for (const line of git("log", "--format=%x00%cI", "--name-only", "--", "src/content/docs").split("\n")) {
      if (line.startsWith("\0")) date = line.slice(1);
      else if (/\.mdx?$/.test(line)) {
        const slug = line.replace(/^src\/content\/docs\//, "").replace(/\.mdx?$/, "").replace(/(^|\/)index$/, "");
        const path = slug ? `/${slug}/` : "/";
        // git log lists newest first, so the first date seen is the latest.
        if (!dates.has(path)) dates.set(path, date);
      }
    }
  } catch {
    // Not a git checkout: leave lastmod out.
  }
  return dates;
}
const LAST_MODIFIED = docsLastModified();

export default defineConfig({
  site: "https://docs.gpuflow.app",
  trailingSlash: "always",
  redirects: REDIRECTS,
  integrations: [
    cloudflareRedirects,
    sitemap({
      serialize(item) {
        const lastmod = LAST_MODIFIED.get(new URL(item.url).pathname);
        if (lastmod) item.lastmod = lastmod;
        return item;
      },
      i18n: {
        defaultLocale: "en",
        locales: Object.fromEntries(
          Object.entries(LOCALES).map(([key, { lang }]) => [
            key === "root" ? "en" : key,
            lang,
          ]),
        ),
      },
    }),
    starlight({
      title: {
        en: "GPUFlow Docs",
        de: "GPUFlow Doku",
        es: "Documentación de GPUFlow",
        fr: "Documentation GPUFlow",
        ja: "GPUFlow ドキュメント",
        ko: "GPUFlow 문서",
        "zh-CN": "GPUFlow 文档",
        "zh-TW": "GPUFlow 文件",
        "pt-BR": "Documentação do GPUFlow",
        ru: "Документация GPUFlow",
        he: "תיעוד GPUFlow",
        ar: "توثيق GPUFlow",
        hi: "GPUFlow दस्तावेज़",
      },
      defaultLocale: "root",
      locales: LOCALES,
      components: {
        Head: "./src/components/Head.astro",
      },
      head: [
        { tag: "meta", attrs: { name: "theme-color", content: "#f97316" } },
      ],
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/kixago/gpuflow-docs",
        },
      ],
      customCss: ["./src/styles/custom.css"],
      plugins: [
        starlightPageActions({
          prompt:
            "You are helping someone use GPUFlow (gpuflow.app), a marketplace where people rent GPUs by the hour through an OpenAI-compatible API, or rent out their own GPU. Read {url} and explain the steps it describes.",
          actions: {
            markdown: false,
            share: true,
            custom: {},
          },
        }),
        starlightLlmsTxt({
          projectName: "GPUFlow",
          description:
            "GPUFlow (gpuflow.app) is a marketplace where people rent GPUs by the hour from other people. A renter adds credits by card, rents a GPU for a number of hours and gets an OpenAI-compatible API key for it. A provider runs one command on a Linux machine with a GPU, lists it with an hourly price, and cashes out earnings to a bank account through Stripe.",
          details: `
## Key facts

- Renters pay with credits bought by card through Stripe ($10 to $500 per top-up, no fee). 1 credit = $0.01.
- A rental holds credits for the hours booked (1 to 168 hours unless the listing says otherwise). Use is billed to the second with a 1-minute minimum; unused time goes back to the renter's credits when the rental ends.
- A rental is an OpenAI-compatible API: base URL https://gpuflow.app/v1, key starting with gfk_, endpoints /v1/models and /v1/chat/completions (streaming supported). No SSH, shell or VPN.
- If the provider's machine is offline for 10 minutes, the rental ends and the renter pays only until it went offline.
- After a paid rental ends, the renter can rate it 1 to 5 stars with an optional comment (within 30 days, editable for 14 days). The average shows on the listing; the provider can reply publicly once per review.
- Providers install the agent with one command on 64-bit Linux with systemd (NVIDIA tested; AMD through Ollama's ROCm support). No Docker, no open ports.
- GPUFlow keeps a 12% fee from each rental. Earnings are held 7 days (14 days for accounts younger than 30 days), then can be cashed out: minimum $25, $2.50 fee per cash-out, to a bank account through Stripe in the US, Canada, the UK, Switzerland and the European Economic Area.
- The documentation is available in 13 languages; English is at the root, other languages under /de/, /es/, /fr/, /ja/, /ko/, /zh-cn/, /zh-tw/, /pt-br/, /ru/, /he/, /ar/, /hi/.
          `.trim(),
          optionalLinks: [
            {
              label: "GPUFlow marketplace",
              url: "https://gpuflow.app/en/marketplace",
              description: "Browse GPUs for rent",
            },
          ],
          customSets: [
            {
              label: "Renting a GPU",
              description:
                "Create an account, add credits, rent a GPU, use the API key, billing and refunds, fixing errors",
              paths: ["renters/**"],
            },
            {
              label: "Providing a GPU",
              description:
                "Put a Linux GPU machine online, create a listing, price it, get paid, security, fixing problems",
              paths: ["providers/**"],
            },
          ],
          promote: [
            "index",
            "renters/getting-started",
            "renters/api-quickstart",
            "providers/getting-started",
            "providers/pricing",
          ],
          demote: ["renters/troubleshooting", "providers/troubleshooting"],
          minify: { whitespace: true },
          pageSeparator: "\n\n---\n\n",
          rawContent: false,
        }),
        externalLinksPlugin,
        analyticsPlugin,
      ],
      sidebar: [
        {
          label: "Renting a GPU",
          translations: SIDEBAR_LABELS.renters,
          autogenerate: { directory: "renters" },
        },
        {
          label: "Providing a GPU",
          translations: SIDEBAR_LABELS.providers,
          autogenerate: { directory: "providers" },
        },
      ],
    }),
  ],
});
