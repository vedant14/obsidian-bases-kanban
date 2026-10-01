import type { BasesEntry } from 'obsidian';
import { setIcon } from 'obsidian';
import { CSS_CLASSES, DATA_ATTRIBUTES } from '../constants.ts';
import { createCard, computeCardFingerprint, type CardRenderCtx, type CardCallbacks } from './card.ts';
import { isListPropertyValue } from '../utils/grouping.ts';

export interface ColumnRenderCtx {
	doc: Document;
	card: CardRenderCtx;
	cardCb: CardCallbacks;
	prefs: { collapsedColumns: Set<string> };
	nestedGroups: Map<string, Map<string, BasesEntry[]>> | null;
	// All status/group values seen on the board, including configured values that
	// currently have no cards. Empty groups still need a sortable body so cards
	// can be moved into a sprint without changing their status.
	groupValues: string[];
	groupOrder: string[];
	dragging: boolean;
	cardFingerprints: Map<string, string>;
	// Column values that are empty across the whole board (every swimlane). These
	// persist only because they're saved in columnOrder, so they get a remove
	// button. Board-wide, so it can't be derived from a single column's entries.
	globallyEmptyColumns: Set<string>;
	getColumnSubtitle: (columnValue: string) => string | null;
}

export interface ColumnCallbacks {
	onToggleCollapsed: (columnValue: string, columnEl: HTMLElement, toggleBtn: HTMLElement) => void;
	onRemoveColumn: (columnValue: string, columnEl: HTMLElement) => void;
	createAddButton: (columnValue: string, swimlaneValue: string | null) => HTMLElement;
	getQuickAddFolder: () => string | null;
}

export function createRemoveButton(doc: Document, value: string, onRemove: () => void): HTMLElement {
	const btn = doc.createElement('div');
	btn.className = CSS_CLASSES.COLUMN_REMOVE_BTN;
	btn.setAttribute('aria-label', `Remove column: ${value}`);
	btn.setAttribute('role', 'button');
	btn.textContent = '×';
	btn.addEventListener('click', (e) => {
		e.stopPropagation();
		onRemove();
	});
	return btn;
}

export function updateColumnToggle(toggleBtn: HTMLElement, isCollapsed: boolean): void {
	toggleBtn.empty();
	setIcon(toggleBtn, isCollapsed ? 'chevron-right' : 'chevron-down');
	toggleBtn.setAttribute('aria-label', isCollapsed ? 'Expand column' : 'Collapse column');
	toggleBtn.setAttribute('title', isCollapsed ? 'Expand column' : 'Collapse column');
	toggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
}

export function createColumn(
	value: string,
	entries: BasesEntry[],
	options: { swimlaneValue?: string | null },
	ctx: ColumnRenderCtx,
	cb: ColumnCallbacks,
): HTMLElement {
	const columnEl = ctx.doc.createElement('div');
	columnEl.className = CSS_CLASSES.COLUMN;
	columnEl.setAttribute(DATA_ATTRIBUTES.COLUMN_VALUE, value);
	const isCollapsed = ctx.prefs.collapsedColumns.has(value);
	if (isCollapsed) columnEl.classList.add(CSS_CLASSES.COLUMN_COLLAPSED);

	const headerEl = columnEl.createDiv({ cls: CSS_CLASSES.COLUMN_HEADER });

	const dragHandle = headerEl.createDiv({ cls: CSS_CLASSES.COLUMN_DRAG_HANDLE });
	dragHandle.textContent = '⋮⋮';

	const toggleBtn = headerEl.createEl('button', {
		cls: CSS_CLASSES.COLUMN_TOGGLE,
		attr: { type: 'button' },
	});
	updateColumnToggle(toggleBtn, isCollapsed);
	toggleBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		cb.onToggleCollapsed(value, columnEl, toggleBtn);
	});

	const headingEl = headerEl.createDiv({ cls: CSS_CLASSES.COLUMN_HEADING });
	headingEl.createSpan({ text: formatColumnLabel(value), cls: CSS_CLASSES.COLUMN_TITLE });
	const subtitle = ctx.getColumnSubtitle(value);
	if (subtitle) headingEl.createSpan({ text: `Starts ${subtitle}`, cls: CSS_CLASSES.COLUMN_SUBTITLE });
	headerEl.createSpan({ text: `${entries.length}`, cls: CSS_CLASSES.COLUMN_COUNT });

	if (cb.getQuickAddFolder()) {
		headerEl.appendChild(cb.createAddButton(value, options.swimlaneValue ?? null));
	}

	if (ctx.globallyEmptyColumns.has(value)) {
		headerEl.appendChild(createRemoveButton(ctx.doc, value, () => cb.onRemoveColumn(value, columnEl)));
	}

	const groups = ctx.nestedGroups ? (ctx.nestedGroups.get(value) ?? new Map<string, BasesEntry[]>()) : null;
	if (groups) {
		const liveGroups = [...new Set([...groups.keys(), ...ctx.groupValues])];
		const orderedGroups = [
			...ctx.groupOrder.filter((group) => liveGroups.includes(group)),
			...liveGroups.filter((group) => !ctx.groupOrder.includes(group)),
		];
		orderedGroups.forEach((groupValue) => {
			const groupEl = columnEl.createDiv({ cls: CSS_CLASSES.COLUMN_GROUP });
			groupEl.setAttribute(DATA_ATTRIBUTES.INNER_GROUP_VALUE, groupValue);
			const groupHeader = groupEl.createDiv({ cls: CSS_CLASSES.COLUMN_GROUP_TITLE });
			groupHeader.createSpan({ text: formatColumnLabel(groupValue) });
			groupHeader.createSpan({ text: `${groups.get(groupValue)?.length ?? 0}`, cls: CSS_CLASSES.COLUMN_GROUP_COUNT });
			const groupBody = groupEl.createDiv({ cls: `${CSS_CLASSES.COLUMN_BODY} ${CSS_CLASSES.COLUMN_GROUP_BODY}` });
			groupBody.setAttribute(DATA_ATTRIBUTES.SORTABLE_CONTAINER, 'true');
			(groups.get(groupValue) ?? []).forEach((entry) => {
				groupBody.appendChild(
					createCard(
						entry,
						ctx.card,
						ctx.cardCb,
						value,
						ctx.card.groupByPropertyId !== null && isListPropertyValue(entry.getValue(ctx.card.groupByPropertyId)),
					),
				);
			});
		});
	} else {
		const bodyEl = columnEl.createDiv({ cls: CSS_CLASSES.COLUMN_BODY });
		bodyEl.setAttribute(DATA_ATTRIBUTES.SORTABLE_CONTAINER, 'true');
		entries.forEach((entry) => {
			bodyEl.appendChild(
				createCard(
					entry,
					ctx.card,
					ctx.cardCb,
					value,
					ctx.card.groupByPropertyId !== null && isListPropertyValue(entry.getValue(ctx.card.groupByPropertyId)),
				),
			);
		});
	}

	return columnEl;
}

export function formatColumnLabel(value: string): string {
	const match = value.match(/^\[\[([^\]|#]+)(?:\|([^\]]+))?(?:#[^\]]+)?\]\]$/);
	return match ? (match[2] ?? match[1]).trim() : value;
}

export function patchColumnCards(
	columnEl: HTMLElement,
	newEntries: BasesEntry[],
	ctx: ColumnRenderCtx,
	cb: ColumnCallbacks,
): void {
	const body = columnEl.querySelector<HTMLElement>(`.${CSS_CLASSES.COLUMN_BODY}`);
	if (!body) return;

	const countEl = columnEl.querySelector(`.${CSS_CLASSES.COLUMN_COUNT}`);
	if (countEl) countEl.textContent = `${newEntries.length}`;

	// The remove button reflects board-wide emptiness, not this column's local
	// count: in swimlane mode a column can be empty in one lane while holding cards
	// in another, so `newEntries.length` is not a reliable signal of global emptiness.
	const headerEl = columnEl.querySelector<HTMLElement>(`.${CSS_CLASSES.COLUMN_HEADER}`);
	const columnValue = columnEl.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE);
	const existingRemoveBtn = headerEl?.querySelector(`.${CSS_CLASSES.COLUMN_REMOVE_BTN}`) ?? null;
	const showRemoveButton = !!columnValue && ctx.globallyEmptyColumns.has(columnValue);
	if (headerEl && showRemoveButton && !existingRemoveBtn && columnValue) {
		headerEl.appendChild(createRemoveButton(ctx.doc, columnValue, () => cb.onRemoveColumn(columnValue, columnEl)));
	} else if (!showRemoveButton && existingRemoveBtn) {
		existingRemoveBtn.remove();
	}

	const existingAddBtn = headerEl?.querySelector(`.${CSS_CLASSES.COLUMN_ADD_BTN}`) ?? null;
	const hasFolder = !!cb.getQuickAddFolder();
	if (headerEl && columnValue && hasFolder && !existingAddBtn) {
		const swimlaneEl = columnEl.closest<HTMLElement>(`[${DATA_ATTRIBUTES.SWIMLANE_VALUE}]`);
		const swimlaneValue = swimlaneEl?.getAttribute(DATA_ATTRIBUTES.SWIMLANE_VALUE) ?? null;
		headerEl.appendChild(cb.createAddButton(columnValue, swimlaneValue));
	} else if (!hasFolder && existingAddBtn) {
		existingAddBtn.remove();
	}

	const newPaths = new Set(newEntries.map((e) => e.file.path));
	const seenPaths = new Set<string>();
	body.querySelectorAll<HTMLElement>(`.${CSS_CLASSES.CARD}`).forEach((card) => {
		const path = card.getAttribute(DATA_ATTRIBUTES.ENTRY_PATH);
		if (!path || !newPaths.has(path) || seenPaths.has(path)) card.remove();
		else seenPaths.add(path);
	});

	const existingCards = new Map<string, HTMLElement>();
	body.querySelectorAll<HTMLElement>(`.${CSS_CLASSES.CARD}`).forEach((card) => {
		const path = card.getAttribute(DATA_ATTRIBUTES.ENTRY_PATH);
		if (path) existingCards.set(path, card);
	});
	newEntries.forEach((entry) => {
		const fp = computeCardFingerprint(entry, ctx.card);
		const fingerprintKey = `${entry.file.path}\u0000${columnValue ?? ''}`;
		const existing = existingCards.get(entry.file.path);
		if (existing && ctx.cardFingerprints.get(fingerprintKey) === fp) {
			return;
		}
		const newCard = createCard(
			entry,
			ctx.card,
			ctx.cardCb,
			columnEl.getAttribute(DATA_ATTRIBUTES.COLUMN_VALUE) ?? '',
			ctx.card.groupByPropertyId !== null && isListPropertyValue(entry.getValue(ctx.card.groupByPropertyId)),
		);
		ctx.cardFingerprints.set(fingerprintKey, fp);
		if (existing) {
			body.replaceChild(newCard, existing);
		} else {
			body.appendChild(newCard);
		}
	});

	// Reorder cards in the DOM to match newEntries order.
	// Skipped during active drags — Sortable owns the DOM during a drag and
	// reordering here would fight its live preview, causing visual thrashing.
	if (!ctx.dragging) {
		const pathToCard = new Map<string, Element>();
		body.querySelectorAll(`.${CSS_CLASSES.CARD}`).forEach((card) => {
			const path = card.instanceOf(HTMLElement) ? card.getAttribute(DATA_ATTRIBUTES.ENTRY_PATH) : null;
			if (path) pathToCard.set(path, card);
		});
		newEntries.forEach((entry) => {
			const card = pathToCard.get(entry.file.path);
			if (card) body.appendChild(card);
		});
	}
}
