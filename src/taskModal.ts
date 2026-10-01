import type { App } from 'obsidian';
import { Modal, TextComponent } from 'obsidian';
import { CSS_CLASSES } from './constants.ts';
import { appendTaskToFile, formatTaskLine } from './utils/tasks.ts';
import type { TFile } from 'obsidian';

export class TaskModal extends Modal {
	private description: TextComponent | null = null;
	private dueDate: HTMLInputElement | null = null;
	private submitting = false;

	constructor(
		app: App,
		private readonly file: TFile,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(`Add task to ${this.file.basename}`);
		const form = this.contentEl.createEl('form', { cls: CSS_CLASSES.TASK_FORM });
		this.description = new TextComponent(form);
		this.description.setPlaceholder('Share with design team');
		this.description.inputEl.classList.add(CSS_CLASSES.TASK_INPUT);

		const dateLabel = form.createEl('label', { text: 'Due date' });
		this.dueDate = dateLabel.createEl('input', { attr: { type: 'date' } });
		const today = new Date();
		this.dueDate.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

		const actions = form.createDiv({ cls: CSS_CLASSES.TASK_ACTIONS });
		actions
			.createEl('button', { text: 'Cancel', attr: { type: 'button' } })
			.addEventListener('click', () => this.close());
		const submit = actions.createEl('button', { text: 'Add task', cls: 'mod-cta', attr: { type: 'submit' } });
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			void this.submit(submit);
		});
		window.requestAnimationFrame(() => this.description?.inputEl.focus());
	}

	onClose(): void {
		this.contentEl.empty();
		this.description = null;
		this.dueDate = null;
		this.submitting = false;
	}

	private async submit(button: HTMLButtonElement): Promise<void> {
		if (this.submitting) return;
		const description = this.description?.getValue().trim() ?? '';
		if (!description) {
			this.description?.inputEl.focus();
			return;
		}
		this.submitting = true;
		button.disabled = true;
		try {
			await appendTaskToFile(this.app, this.file, formatTaskLine(description, this.dueDate?.value ?? ''));
			this.close();
		} catch (error) {
			this.submitting = false;
			button.disabled = false;
			throw error;
		}
	}
}
