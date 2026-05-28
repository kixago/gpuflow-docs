// @ts-check
import starlight from "@astrojs/starlight";
import starlightPageActions from "starlight-page-actions";
import sitemap from "@astrojs/sitemap";
import starlightLlmsTxt from "starlight-llms-txt";
import { defineConfig } from "astro/config";

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
export default defineConfig({
  site: "https://docs.gpuflow.app",
  integrations: [
    sitemap(),
    starlight({
      title: "GPUFlow Documentation",
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
            "You are a technical assistant helping the user understand the GPU Marketplace GpuFlow.app. Read {url} and summarize the most important concepts.",
          baseUrl: "https://docs.gpuflow.app/",
          actions: {
            markdown: false,
            share: true,
            custom: {},
          },
        }),
        starlightLlmsTxt({
          // Core Identity
          projectName: "GPUFlow",

          // Description shown in llms.txt after title
          description: `GPUFlow is a decentralized GPU rental marketplace that connects GPU owners with users who need computational resources. It creates a peer-to-peer marketplace for GPU computing power, enabling affordable access to high-performance GPUs worldwide for AI training, cryptocurrency mining, 3D rendering, and more. Built on Web3 technology.`,

          // Additional context for LLMs
          details: `
## Key Concepts

- **GPU Providers**: Users who list their GPUs to earn passive income by renting out computational resources
- **GPU Renters**: Users who pay to access GPU power for AI/ML training, mining, rendering, or gaming
- **Web3 Integration**: Multi-wallet support and cryptocurrency payments
- **WireGuard P2P**: Secure peer-to-peer networking between renters and provider hardware

## Platform Components

- Provider Software: Application that GPU owners install to list and manage their hardware (supports Linux and Windows, NVIDIA and AMD GPUs)
- Container Runtime: Podman/Docker-based isolation for secure GPU access
- Web Terminal: Browser-based development environment for renters
- WireGuard VPN: Encrypted P2P connections between renters and GPU hardware

## Supported Hardware

- **NVIDIA GPUs**: Full support on Linux and Windows
- **AMD GPUs**: Full support on Linux and Windows
- **Container Runtimes**: Podman (recommended) and Docker

## User Types

1. **Providers**: GPU owners who install software, configure networking, create listings, and earn cryptocurrency
2. **Renters**: Users who browse GPUs, connect wallets, rent hardware, and access via terminal or WireGuard
          `.trim(),

          // Optional external resources
          optionalLinks: [
            {
              label: "GPUFlow Platform",
              url: "https://gpuflow.app",
              description: "Main GPUFlow application and marketplace",
            },
            {
              label: "GitHub Repository",
              url: "https://github.com/kixago/gpuflow-docs",
              description:
                "Documentation source code and contribution guidelines",
            },
          ],

          // Documentation subsets based on your actual structure
          customSets: [
            {
              label: "Provider Documentation",
              description:
                "Complete guide for GPU providers - installation, configuration, networking, operations, and troubleshooting for both Linux and Windows with NVIDIA and AMD GPU support",
              paths: ["providers/**"],
            },
            {
              label: "Renter Documentation",
              description:
                "Complete guide for GPU renters - getting started, how to rent, wallet setup, access methods, WireGuard client setup, use cases, and troubleshooting",
              paths: ["renters/**"],
            },
            {
              label: "Installation Guides",
              description:
                "Step-by-step installation instructions for provider software on Linux and Windows for both NVIDIA and AMD GPUs, including container runtime setup",
              paths: ["providers/installation/**"],
            },
            {
              label: "Provider Configuration",
              description:
                "Account setup, wallet management, creating GPU listings, and security best practices for providers",
              paths: ["providers/configuration/**"],
            },
            {
              label: "Networking & Connectivity",
              description:
                "WireGuard P2P setup for providers and WireGuard client configuration for renters",
              paths: ["providers/networking/**", "renters/wireguard-client"],
            },
            {
              label: "Troubleshooting",
              description:
                "Troubleshooting guides for providers (Linux and Windows) and renters",
              paths: ["providers/troubleshooting-*", "renters/troubleshooting"],
            },
            {
              label: "Security",
              description:
                "Security best practices and wallet management documentation",
              paths: [
                "providers/configuration/security-best-practices",
                "providers/configuration/wallet-management",
              ],
            },
          ],

          // Pages to show first in output files
          promote: [
            "index", // Homepage
            "providers/getting-started", // Provider getting started
            "renters/getting-started", // Renter getting started
            "renters/how-to-rent-gpu", // Core renter workflow
            "providers/configuration/account-setup", // First config step
          ],

          // Pages to show last in output files
          demote: [
            "providers/troubleshooting-*", // Troubleshooting at the end
            "renters/troubleshooting", // Troubleshooting at the end
          ],

          // Pages to exclude from small context version
          exclude: [
            "providers/troubleshooting-*", // Detailed troubleshooting
            "renters/troubleshooting", // Detailed troubleshooting
          ],

          // Minification settings for llms-small.txt
          minify: {
            note: true, // Exclude notes (supplementary info)
            tip: true, // Exclude tips (nice-to-have)
            caution: false, // KEEP caution (important for hardware/wallet safety)
            danger: false, // KEEP danger (critical warnings)
            details: true, // Exclude collapsible details
            whitespace: true, // Collapse whitespace

            // Custom elements to exclude (adjust based on your actual components)
            customSelectors: [".edit-on-github", ".page-navigation"],
          },

          // Page separator in concatenated files
          pageSeparator: "\n\n---\n\n",

          // Set to false since you're using MDX without framework components
          rawContent: false,
        }),
        externalLinksPlugin,
        analyticsPlugin,
      ],
      sidebar: [
        {
          label: "GPU Providers",
          autogenerate: { directory: "providers" },
        },
        {
          label: "GPU Renters",
          autogenerate: { directory: "renters" },
        },
        {
          label: "Developers",
          autogenerate: { directory: "developers" },
        },
        {
          label: "Guides",
          autogenerate: { directory: "guides" },
        },
        {
          label: "Reference",
          autogenerate: { directory: "reference" },
        },
      ],
    }),
  ],
});
