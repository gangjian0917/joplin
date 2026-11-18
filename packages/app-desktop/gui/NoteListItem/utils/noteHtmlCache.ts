import { NoteEntity } from '@joplin/lib/services/database/types';
import Note from '@joplin/lib/models/Note';
import { formatMsToRelative } from '@joplin/utils/time';

// Cache of rendered note item HTML, keyed by note ID. When a note item is
// mounted during fast scrolling it can synchronously show the last rendered
// content instead of staying empty until the async render pipeline
// (useRenderedNote) completes — the async result then replaces the placeholder.
// Map insertion order doubles as LRU order; entries beyond maxEntries are
// dropped from the front.

const maxEntries = 500;

const cache_ = new Map<string, string>();

export const setCachedNoteHtml = (noteId: string, html: string) => {
	cache_.delete(noteId);
	cache_.set(noteId, html);
	if (cache_.size > maxEntries) {
		const oldest = cache_.keys().next().value;
		cache_.delete(oldest);
	}
};

export const getCachedNoteHtml = (noteId: string): string | undefined => {
	const html = cache_.get(noteId);
	if (html !== undefined) {
		// Refresh LRU position
		cache_.delete(noteId);
		cache_.set(noteId, html);
	}
	return html;
};

const escapeHtml = (text: string): string => {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
};

// Synchronous fallback rendering for a note that has no cached HTML yet.
// Mirrors the compact list renderer's itemTemplate structure (classes and
// element order) so that replacing the placeholder with the real render does
// not cause layout shift.
export const renderNotePlaceholderHtml = (note: NoteEntity, isSelected: boolean): string => {
	const displayTitle = Note.displayTitle(note);
	const escapedTitle = escapeHtml(displayTitle ?? '');

	const contentClasses = [
		'content',
		isSelected ? '-selected' : '',
		note.is_shared && !note.share_id ? '-shared' : '',
		note.todo_completed ? '-completed' : '',
	].filter(c => !!c).join(' ');

	let todoHtml = '';
	if (note.is_todo) {
		todoHtml = `
			<div class="checkbox">
				<input data-id="todo-checkbox" type="checkbox" tabindex="-1" aria-label="${escapedTitle}"${note.todo_completed ? ' checked="checked"' : ''}>
			</div>`;
	}

	return `
		<div class="${contentClasses}">
			${todoHtml}
			<div class="title" data-id="${note.id}">
				<i class="watchedicon fa fa-share-square"></i>
				<span>${escapedTitle}</span>
			</div>
		</div>`;
};

// Relative time formatting identical to renderViewProps, so placeholder and
// real render show the same text.
export const formatNoteRelativeTime = (ms: number): string => formatMsToRelative(ms);
