import type { BasesEntry } from 'obsidian';
import { UNCATEGORIZED_LABEL } from '../constants.ts';

/**
 * Ensures a group exists in the map, creating it if necessary
 * @param grouped - The map of groups
 * @param key - The key to ensure exists
 * @returns The array for the specified key
 */
export function ensureGroupExists(grouped: Map<string, BasesEntry[]>, key: string): BasesEntry[] {
	if (!grouped.has(key)) {
		grouped.set(key, []);
	}
	const group = grouped.get(key);
	if (!group) {
		// This should never happen, but TypeScript needs the check
		const newGroup: BasesEntry[] = [];
		grouped.set(key, newGroup);
		return newGroup;
	}
	return group;
}

/**
 * Normalizes a property value to a string, using Uncategorized for empty values
 * @param value - The property value to normalize (typically a Value object from Obsidian Bases)
 * @returns Normalized string value
 */
export function normalizePropertyValue(value: unknown): string {
	// Handle null/undefined
	if (value === null || value === undefined) {
		return UNCATEGORIZED_LABEL;
	}

	// Value objects from Obsidian Bases have toString()
	if (typeof value === 'object' && value !== null && isStringifiable(value)) {
		// eslint-disable-next-line @typescript-eslint/no-base-to-string -- Obsidian Value objects provide custom toString().
		const stringValue = value.toString().trim();
		return stringValue === '' || stringValue === 'null' ? UNCATEGORIZED_LABEL : stringValue;
	}

	// Primitives
	if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
		return UNCATEGORIZED_LABEL;
	}
	const stringValue = typeof value === 'string' ? value : String(value);
	const trimmed = stringValue.trim();
	return trimmed === '' || trimmed === 'null' ? UNCATEGORIZED_LABEL : trimmed;
}

type ListValueLike = {
	length(): number;
	get(index: number): { toString(): string };
};

type Stringifiable = {
	toString(): string;
};

function isStringifiable(value: object): value is Stringifiable {
	return typeof value.toString === 'function';
}

function isUnknownArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

function isListValueLike(value: unknown): value is ListValueLike {
	return (
		typeof value === 'object' &&
		value !== null &&
		'length' in value &&
		typeof value.length === 'function' &&
		'get' in value &&
		typeof value.get === 'function'
	);
}

/**
 * Returns the rendered group value(s) for a property. ListValue and array
 * properties expand into one association per item; empty lists are
 * Uncategorized. Duplicate list items are rendered only once.
 */
export function normalizePropertyValues(value: unknown): string[] {
	const items: unknown[] = Array.isArray(value)
		? value
		: isListValueLike(value)
			? Array.from({ length: value.length() }, (_, index) => value.get(index))
			: [value];

	const normalized = items.map((item) => normalizePropertyValue(item)).filter((item) => item !== UNCATEGORIZED_LABEL);
	return normalized.length > 0 ? [...new Set(normalized)] : [UNCATEGORIZED_LABEL];
}

export function isListPropertyValue(value: unknown): boolean {
	return Array.isArray(value) || isListValueLike(value);
}

/** Update a list-valued frontmatter property without replacing unrelated items. */
export function updateListPropertyValue(
	existingValue: unknown,
	sourceValue: string,
	destinationValue: string | null,
): unknown[] | undefined {
	const values: unknown[] = isUnknownArray(existingValue)
		? [...existingValue]
		: existingValue === undefined || existingValue === null
			? []
			: [existingValue];
	const remaining = values.filter((value) => normalizePropertyValue(value) !== sourceValue);
	if (destinationValue && !remaining.some((value) => normalizePropertyValue(value) === destinationValue)) {
		remaining.push(destinationValue);
	}
	return remaining.length > 0 ? remaining : undefined;
}
