import type { App, TFile } from 'obsidian';
import { Modal } from 'obsidian';
import { CSS_CLASSES } from './constants.ts';
import { TaskModal } from './taskModal.ts';
import { parseOpenTasks, toggleTaskInMarkdown, type OpenTask } from './utils/tasks.ts';

export class OpenTasksModal extends Modal {
	private tasks: OpenTask[] = [];

	constructor(
		app: App,
		private readonly file: TFile,
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.classList.add('obk-open-tasks-modal');
		this.setTitle(this.file.basename);
		this.renderLoading();
		void this.loadTasks();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderLoading(): void {
		this.contentEl.empty();
		this.contentEl.createDiv({ text: 'Loading tasks…', cls: CSS_CLASSES.TASK_EMPTY });
	}

	private async loadTasks(): Promise<void> {
		try {
			this.tasks = parseOpenTasks(await this.app.vault.read(this.file));
			this.render();
		} catch (error) {
			console.error('Error reading tasks:', error);
			this.contentEl.empty();
			this.contentEl.createDiv({ text: 'Could not read tasks.', cls: CSS_CLASSES.TASK_EMPTY });
		}
	}

	private render(): void {
		this.contentEl.empty();
		this.contentEl.createDiv({
			text: `${this.tasks.length} open task${this.tasks.length === 1 ? '' : 's'}`,
			cls: CSS_CLASSES.TASK_SUMMARY,
		});
		const list = this.contentEl.createDiv({ cls: CSS_CLASSES.TASK_LIST });
		if (this.tasks.length === 0) {
			list.createDiv({ text: 'No open tasks.', cls: CSS_CLASSES.TASK_EMPTY });
		} else {
			this.tasks.forEach((task) => {
				const row = list.createDiv({ cls: CSS_CLASSES.TASK_ROW });
				const checkbox = row.createEl('input', {
					cls: CSS_CLASSES.TASK_CHECKBOX,
					attr: { type: 'checkbox', 'aria-label': `Complete task: ${task.description}` },
				});
				checkbox.addEventListener('change', () => void this.completeTask(task, checkbox));
				row.createSpan({ text: task.description, cls: CSS_CLASSES.TASK_TEXT });
				if (task.dueDate) row.createSpan({ text: `📅 ${task.dueDate}`, cls: CSS_CLASSES.TASK_DUE });
			});
		}

		const actions = this.contentEl.createDiv({ cls: CSS_CLASSES.TASK_ACTIONS });
		const addButton = actions.createEl('button', { text: 'Add task', cls: 'mod-cta' });
		addButton.addEventListener('click', () => new TaskModal(this.app, this.file).open());
		const openButton = actions.createEl('button', { text: 'Open note' });
		openButton.addEventListener('click', () => {
			void this.app.workspace.openLinkText(this.file.path, '', false);
			this.close();
		});
	}

	private async completeTask(task: OpenTask, checkbox: HTMLInputElement): Promise<void> {
		checkbox.disabled = true;
		try {
			const markdown = await this.app.vault.read(this.file);
			const updated = toggleTaskInMarkdown(markdown, task.lineIndex, true);
			if (updated !== markdown) await this.app.vault.modify(this.file, updated);
			this.tasks = parseOpenTasks(updated);
			this.render();
		} catch (error) {
			checkbox.checked = false;
			checkbox.disabled = false;
			console.error('Error completing task:', error);
		}
	}
}
