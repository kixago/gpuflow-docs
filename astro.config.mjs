// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Simple plugin to add external link handling
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

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'GPUFlow Documentation',
			social: [{ 
				icon: 'github', 
				label: 'GitHub', 
				href: 'https://github.com/withastro/starlight' 
			}],
			customCss: ['./src/styles/custom.css'],
			plugins: [externalLinksPlugin],
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
