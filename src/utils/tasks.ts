import type { App, TFile } from 'obsidian';

export interface OpenTask {
	lineIndex: number;
	rawLine: string;
	description: string;
	dueDate: string | null;
}

export function formatTaskLine(description: string, dueDate: string): string {
	const cleanDescription = description.replace(/[\r\n]+/g, ' ').trim();
	return `- [ ] ${cleanDescription}${dueDate ? ` 📅 ${dueDate}` : ''}`;
}

export function parseOpenTasks(markdown: string): OpenTask[] {
	return markdown
		.replace(/\r\n/g, '\n')
		.split('\n')
		.map((line, lineIndex) => {
			const match = line.match(/^\s*[-*]\s+\[ \]\s+(.*)$/);
			if (!match) return null;
			const dueMatch = match[1].match(/\s+📅\s+(\d{4}-\d{2}-\d{2})\s*$/);
			return {
				lineIndex,
				rawLine: line,
				description: (dueMatch ? match[1].slice(0, dueMatch.index) : match[1]).trim(),
				dueDate: dueMatch?.[1] ?? null,
			};
		})
		.filter((task): task is OpenTask => task !== null);
}

export function toggleTaskInMarkdown(markdown: string, lineIndex: number, checked: boolean): string {
	const lines = markdown.replace(/\r\n/g, '\n').split('\n');
	if (!lines[lineIndex] || !/^\s*[-*]\s+\[ [ ]\]\s+/.test(lines[lineIndex])) {
		if (!lines[lineIndex] || !/^\s*[-*]\s+\[.\]\s+/.test(lines[lineIndex])) return markdown;
	}
	lines[lineIndex] = lines[lineIndex].replace(/(\[) (\])/, checked ? '$1x$2' : '$1 $2');
	return lines.join('\n');
}

/** Append beneath an existing ## Tasks heading, or create that section. */
export function appendTaskToMarkdown(markdown: string, taskLine: string): string {
	const normalized = markdown.replace(/\r\n/g, '\n');
	if (normalized.split('\n').some((line) => line.trim() === taskLine.trim())) return normalized;

	const lines = normalized.split('\n');
	const taskHeading = lines.findIndex((line) => /^##\s+Tasks\s*$/i.test(line.trim()));
	if (taskHeading === -1) {
		const prefix = normalized.trimEnd();
		return `${prefix}${prefix ? '\n\n' : ''}## Tasks\n\n${taskLine}\n`;
	}

	let insertAt = lines.length;
	for (let index = taskHeading + 1; index < lines.length; index++) {
		if (/^#{1,2}\s+/.test(lines[index].trim())) {
			insertAt = index;
			break;
		}
	}
	const before = lines.slice(0, insertAt).join('\n').replace(/\s*$/, '');
	const after = lines.slice(insertAt).join('\n').replace(/^\s*/, '');
	return `${before}\n${taskLine}${after ? `\n\n${after}` : '\n'}`;
}

export async function appendTaskToFile(app: App, file: TFile, taskLine: string): Promise<void> {
	const markdown = await app.vault.read(file);
	const updated = appendTaskToMarkdown(markdown, taskLine);
	if (updated !== markdown) await app.vault.modify(file, updated);
}
