// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

/**
 * @type {import('@astrojs/starlight/types').StarlightPlugin}
 */
const externalLinksPlugin = {
	name: 'external-links',
	hooks: {
		'config:setup': ({ updateConfig }) => {
			updateConfig({
				head: [
					{
						tag: 'script',
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
						`
					}
				]
			});
		}
	}
};

/**
 * @type {import('@astrojs/starlight/types').StarlightPlugin}
 */
const analyticsPlugin = {
	name: 'docs-analytics',
	hooks: {
		'config:setup': ({ updateConfig }) => {
			// Only add analytics in production
			if (process.env.NODE_ENV === 'production') {
				updateConfig({
					head: [
						{
							tag: 'script',
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
							`
						}
					]
				});
			}
		}
	}
};

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'GPUFlow Documentation',
			social: [{ 
				icon: 'github', 
				label: 'GitHub', 
				href: 'https://github.com/kixago/gpuflow-docs' 
			}],
			customCss: ['./src/styles/custom.css'],
			plugins: [externalLinksPlugin, analyticsPlugin],
			sidebar: [
				{
					label: 'GPU Providers',
					autogenerate: { directory: 'providers' },
				},
				{
					label: 'GPU Renters', 
					autogenerate: { directory: 'renters' },
				},
				{
					label: 'Developers',
					autogenerate: { directory: 'developers' },
				},
				{
					label: 'Guides',
					autogenerate: { directory: 'guides' },
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
			],
		}),
	],
});
