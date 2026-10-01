import type { App } from 'obsidian';

/**
 * Reads a date from the note represented by a column value. Column values are
 * normally wikilinks (for example, [[Sprint 153]]), while the cards in that
 * column can come from completely different notes.
 */
export function getSprintStartDate(app: App | undefined, columnValue: string, propertyName: string): string | null {
	const trimmedPropertyName = propertyName.trim();
	if (!app || !trimmedPropertyName || !columnValue || columnValue === 'Uncategorized') return null;

	const linkMatch = columnValue.match(/^\[\[([^\]|#]+)(?:\|[^\]]+)?(?:#[^\]]+)?\]\]$/);
	const linkPath = (linkMatch?.[1] ?? columnValue).trim();
	const sprintFile = app.metadataCache.getFirstLinkpathDest(linkPath, '');
	if (!sprintFile) return null;

	const rawFrontmatter = app.metadataCache.getCache(sprintFile.path)?.frontmatter;
	if (!rawFrontmatter || typeof rawFrontmatter !== 'object') return null;
	// Obsidian declares FrontMatterCache values as `any`; constrain the value
	// immediately before processing it.
	const rawDate: unknown = Object.entries(rawFrontmatter).find(([key]) => key === trimmedPropertyName)?.[1];
	if (rawDate === null || rawDate === undefined) return null;
	if (typeof rawDate !== 'string' && typeof rawDate !== 'number') return null;

	const date = String(rawDate).trim();
	return date === '' ? null : date;
}
