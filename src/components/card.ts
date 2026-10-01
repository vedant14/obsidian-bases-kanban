import type { App, BasesEntry, BasesPropertyId } from 'obsidian';
import { Keymap, NullValue } from 'obsidian';
import type { TFile } from 'obsidian';
import { CSS_CLASSES, DATA_ATTRIBUTES, getCardColorName } from '../constants.ts';

export interface CardRenderCtx {
	app: App;
	doc: Document;
	groupByPropertyId: BasesPropertyId | null;
	cardTitlePropertyId: BasesPropertyId | null;
	imagePropertyId: BasesPropertyId | null;
	imageFit: string;
	imageAspectRatio: number;
	wrapValues: boolean;
	cardColorPropertyId: BasesPropertyId | null;
	focusPropertyId: BasesPropertyId | null;
	order: BasesPropertyId[];
	getDisplayName: (id: BasesPropertyId) => string;
	getOpenTaskCount: (filePath: string) => number | null;
}

export interface CardCallbacks {
	onHoverPreview: (linktext: string, sourcePath: string, event: MouseEvent, targetEl: HTMLElement) => void;
	onSetActiveCard: (path: string | null) => void;
	onOpenInBackgroundTab: (file: TFile) => void;
	onToggleFocus: (entry: BasesEntry, focused: boolean, cardEl: HTMLElement, toggleEl: HTMLElement) => void;
	onOpenTasks: (file: TFile) => void;
}

export function computeCardFingerprint(entry: BasesEntry, ctx: CardRenderCtx): string {
	const parts: string[] = [];
	for (const propId of ctx.order) {
		if (propId === ctx.groupByPropertyId) continue;
		const val = entry.getValue(propId);
		parts.push(val === null ? '' : val.toString());
	}
	if (ctx.cardTitlePropertyId) {
		const val = entry.getValue(ctx.cardTitlePropertyId);
		parts.push(val === null ? '' : val.toString());
	}
	if (ctx.imagePropertyId) {
		const val = entry.getValue(ctx.imagePropertyId);
		parts.push(val === null ? '' : val.toString());
	}
	if (ctx.cardColorPropertyId) {
		const val = entry.getValue(ctx.cardColorPropertyId);
		parts.push(val === null ? '' : val.toString());
	}
	if (ctx.focusPropertyId) {
		const val = entry.getValue(ctx.focusPropertyId);
		parts.push(val === null ? '' : val.toString());
	}
	return parts.join('\x00');
}

export function renderCardTitle(titleEl: HTMLElement, entry: BasesEntry, ctx: CardRenderCtx): void {
	if (!ctx.cardTitlePropertyId) {
		titleEl.textContent = entry.file.basename;
		return;
	}
	const titleValue = entry.getValue(ctx.cardTitlePropertyId);
	if (!titleValue || titleValue instanceof NullValue) {
		titleEl.textContent = entry.file.basename;
		return;
	}
	titleValue.renderTo(titleEl, ctx.app.renderContext);
}

export function renderCardCover(
	coverEl: HTMLElement,
	entry: BasesEntry,
	filePath: string,
	ctx: CardRenderCtx,
): boolean {
	if (!ctx.imagePropertyId) return false;
	const value = entry.getValue(ctx.imagePropertyId);
	if (!value || value instanceof NullValue) return false;
	const raw = value.toString().trim();
	if (!raw) return false;

	if (/^https?:\/\//i.test(raw)) {
		coverEl.createEl('img', { attr: { src: raw, alt: '' } });
		return true;
	}

	let linkText = raw.replace(/^!\s*/, '');
	const wikiMatch = linkText.match(/^\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]$/);
	if (wikiMatch) linkText = wikiMatch[1];
	linkText = linkText.trim();
	if (!linkText) return false;

	const app = ctx.app;
	if (!app) return false;
	const file = app.metadataCache.getFirstLinkpathDest(linkText, filePath);
	if (!file) return false;

	coverEl.createEl('img', {
		attr: { src: app.vault.getResourcePath(file), alt: '' },
	});
	return true;
}

export function createCard(
	entry: BasesEntry,
	ctx: CardRenderCtx,
	cb: CardCallbacks,
	groupValue: string,
	groupValueIsList: boolean,
): HTMLElement {
	const cardEl = ctx.doc.createElement('div');
	cardEl.className = CSS_CLASSES.CARD;
	const filePath = entry.file.path;
	cardEl.setAttribute(DATA_ATTRIBUTES.ENTRY_PATH, filePath);
	cardEl.setAttribute(DATA_ATTRIBUTES.GROUP_VALUE, groupValue);
	cardEl.setAttribute(DATA_ATTRIBUTES.GROUP_VALUE_LIST, String(groupValueIsList));

	if (ctx.cardColorPropertyId) {
		const value = entry.getValue(ctx.cardColorPropertyId);
		if (value && !(value instanceof NullValue) && value.toString().trim()) {
			cardEl.classList.add(`${CSS_CLASSES.CARD_COLOR_PREFIX}${getCardColorName(value.toString())}`);
		}
	}

	const isFocused = (): boolean => {
		if (!ctx.focusPropertyId) return false;
		const value = entry.getValue(ctx.focusPropertyId);
		if (!value || value instanceof NullValue) return false;
		const raw = value.toString().trim().toLowerCase();
		return raw === 'true' || raw === 'yes' || raw === '1' || raw === 'on';
	};
	const focused = isFocused();
	if (focused) cardEl.classList.add(CSS_CLASSES.CARD_FOCUSED);

	if (ctx.imagePropertyId) {
		const coverEl = cardEl.createDiv({ cls: CSS_CLASSES.CARD_COVER });
		coverEl.classList.add(
			ctx.imageFit === 'contain' ? CSS_CLASSES.CARD_COVER_FIT_CONTAIN : CSS_CLASSES.CARD_COVER_FIT_COVER,
		);
		coverEl.style.aspectRatio = `1 / ${ctx.imageAspectRatio}`;
		const rendered = renderCardCover(coverEl, entry, filePath, ctx);
		if (!rendered) coverEl.remove();
	}

	const titleRow = cardEl.createDiv({ cls: CSS_CLASSES.CARD_TITLE_ROW });
	const titleEl = titleRow.createDiv({ cls: CSS_CLASSES.CARD_TITLE });
	renderCardTitle(titleEl, entry, ctx);
	const actionsEl = titleRow.createDiv({ cls: CSS_CLASSES.CARD_ACTIONS });
	const openTaskCount = ctx.getOpenTaskCount(filePath);
	if (ctx.focusPropertyId) {
		const focusBtn = actionsEl.createEl('button', {
			cls: CSS_CLASSES.CARD_ACTION,
			text: focused ? '★' : '☆',
			attr: {
				type: 'button',
				'aria-label': focused ? 'Remove focus' : 'Focus on this now',
				title: focused ? 'Remove focus' : 'Focus on this now',
			},
		});
		focusBtn.classList.toggle('is-active', focused);
		focusBtn.addEventListener('click', (event) => {
			event.stopPropagation();
			cb.onToggleFocus(entry, !cardEl.classList.contains(CSS_CLASSES.CARD_FOCUSED), cardEl, focusBtn);
		});
	}
	const openTasksBtn = actionsEl.createEl('button', {
		cls: `${CSS_CLASSES.CARD_ACTION} ${CSS_CLASSES.CARD_TASK_COUNT}`,
		text: `${openTaskCount ?? '…'}`,
		attr: {
			type: 'button',
			'aria-label':
				openTaskCount === null ? 'Open task count loading; show open tasks' : `${openTaskCount} open tasks; show tasks`,
			title: openTaskCount === null ? 'Loading open task count' : `${openTaskCount} open tasks`,
		},
	});
	openTasksBtn.addEventListener('click', (event) => {
		event.stopPropagation();
		cb.onOpenTasks(entry.file);
	});

	for (const propertyId of ctx.order) {
		if (propertyId === ctx.groupByPropertyId) continue;
		const value = entry.getValue(propertyId);
		if (!value || value instanceof NullValue) continue;
		if (!value.toString().trim()) continue;
		const label = ctx.getDisplayName(propertyId);
		const propertyEl = cardEl.createDiv({ cls: CSS_CLASSES.CARD_PROPERTY });
		propertyEl.setAttribute('data-label', propertyId);
		if (ctx.wrapValues) {
			propertyEl.classList.add(CSS_CLASSES.CARD_PROPERTY_WRAP);
		}
		propertyEl.createSpan({ text: label, cls: CSS_CLASSES.CARD_PROPERTY_LABEL });
		const valueEl = propertyEl.createSpan({ cls: CSS_CLASSES.CARD_PROPERTY_VALUE });
		value.renderTo(valueEl, ctx.app.renderContext);
	}

	// JS-managed hover: mouseenter/mouseleave instead of CSS :hover so the
	// class is never applied when an element slides under a stationary cursor
	// after a drag reorders the DOM.
	cardEl.addEventListener('mouseenter', () => cardEl.classList.add(CSS_CLASSES.CARD_HOVER));
	cardEl.addEventListener('mouseleave', () => cardEl.classList.remove(CSS_CLASSES.CARD_HOVER));
	cardEl.addEventListener('mouseover', (e) => {
		if (e.target instanceof Element && e.target.closest('a')) return;
		if (e.relatedTarget instanceof Element && cardEl.contains(e.relatedTarget)) return;
		cb.onHoverPreview(filePath, '', e, cardEl);
	});

	const clickHandler = (e: MouseEvent) => {
		if (e.target instanceof Element && e.target.closest('a')) return;
		if (e.type === 'auxclick' && e.button !== 1) return;
		cb.onSetActiveCard(filePath);
		if (!ctx.app?.workspace) return;
		if (e.button === 1) {
			cb.onOpenInBackgroundTab(entry.file);
			return;
		}
		if (Keymap.isModEvent(e)) {
			void ctx.app.workspace.openLinkText(filePath, '', true);
			return;
		}
		void ctx.app.workspace.openLinkText(filePath, '', false);
	};
	cardEl.addEventListener('click', clickHandler);
	cardEl.addEventListener('auxclick', clickHandler);

	// Prevent middle-click autoscroll inside cards.
	cardEl.addEventListener('mousedown', (e) => {
		if (e.button !== 1) return;
		if (e.target instanceof Element && e.target.closest('a')) return;
		e.preventDefault();
	});

	return cardEl;
}
