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
									
									function connectWebSocket() {
										if (ws?.readyState === WebSocket.OPEN) return;
										
										try {
											ws = new WebSocket('wss://ws.gpuflow.app/ws/client');
											
											ws.onopen = function() {
												const token = 'docs-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8);
												ws.send(JSON.stringify({
													type: 'authenticate',
													data: token
												}));
											};
											
											ws.onmessage = function(event) {
												const msg = JSON.parse(event.data);
												if (msg.type === 'auth_success' && !authenticated) {
													authenticated = true;
													sendPageVisit();
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
									
									function sendPageVisit() {
										if (ws?.readyState === WebSocket.OPEN && authenticated) {
											ws.send(JSON.stringify({
												type: 'page_visit',
												data: {
													url: window.location.pathname + window.location.search,
													title: document.title,
													site: 'docs',
													referrer: document.referrer,
													timestamp: Date.now()
												}
											}));
										}
									}
									
									// Connect on page load
									connectWebSocket();
									
									// Track navigation changes
									let currentPath = window.location.pathname;
									function checkPathChange() {
										if (window.location.pathname !== currentPath) {
											currentPath = window.location.pathname;
											sendPageVisit();
										}
									}
									
									setInterval(checkPathChange, 1000);
									
									// Handle Astro page navigation
									document.addEventListener('astro:page-load', function() {
										setTimeout(sendPageVisit, 100);
									});
									
									// Send page leave on unload
									window.addEventListener('beforeunload', function() {
										if (ws?.readyState === WebSocket.OPEN) {
											ws.send(JSON.stringify({
												type: 'page_leave',
												data: {
													url: window.location.pathname,
													site: 'docs',
													duration: Date.now()
												}
											}));
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
			plugins: [externalLinksPlugin, analyticsPlugin], // Added analyticsPlugin here
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
