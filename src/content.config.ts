import { defineCollection } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';
// @ts-expect-error plain JavaScript module
import { fill } from './lib/limits.mjs';

export const collections = {
	// Titles, descriptions and sidebar labels can use %group.key% too.
	docs: defineCollection({
		loader: docsLoader(),
		schema: (ctx) =>
			docsSchema()(ctx).transform((data) => ({
				...data,
				title: fill(data.title),
				description: fill(data.description),
				sidebar: { ...data.sidebar, label: fill(data.sidebar.label) },
			})),
	}),
	// UI strings Starlight and starlight-page-actions don't ship for some languages
	i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
