import assert from 'node:assert';
import { describe, test } from 'node:test';
import { appendTaskToMarkdown, formatTaskLine, parseOpenTasks, toggleTaskInMarkdown } from '../src/utils/tasks.ts';

describe('Quick task formatting', () => {
	test('formats the requested checkbox and date syntax', () => {
		assert.strictEqual(
			formatTaskLine('Share with Design team', '2026-08-05'),
			'- [ ] Share with Design team 📅 2026-08-05',
		);
	});

	test('creates a Tasks section when one is missing', () => {
		assert.strictEqual(
			appendTaskToMarkdown('# Project\n', '- [ ] Follow up 📅 2026-08-05'),
			'# Project\n\n## Tasks\n\n- [ ] Follow up 📅 2026-08-05\n',
		);
	});

	test('appends to the existing Tasks section before the next heading', () => {
		assert.strictEqual(
			appendTaskToMarkdown('# Project\n\n## Tasks\n\n- [ ] Existing\n\n## Notes\nText\n', '- [ ] New'),
			'# Project\n\n## Tasks\n\n- [ ] Existing\n- [ ] New\n\n## Notes\nText\n',
		);
	});

	test('does not duplicate an existing task', () => {
		const markdown = '## Tasks\n\n- [ ] Existing\n';
		assert.strictEqual(appendTaskToMarkdown(markdown, '- [ ] Existing'), markdown);
	});

	test('parses open tasks and due dates', () => {
		assert.deepStrictEqual(parseOpenTasks('- [ ] Share with Design team 📅 2026-08-05\n- [x] Done'), [
			{
				lineIndex: 0,
				rawLine: '- [ ] Share with Design team 📅 2026-08-05',
				description: 'Share with Design team',
				dueDate: '2026-08-05',
			},
		]);
	});

	test('marks a task complete without changing its text', () => {
		assert.strictEqual(
			toggleTaskInMarkdown('- [ ] Share with Design team 📅 2026-08-05\n', 0, true),
			'- [x] Share with Design team 📅 2026-08-05\n',
		);
	});
});
