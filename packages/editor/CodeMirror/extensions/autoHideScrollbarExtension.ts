import { EditorView } from '@codemirror/view';

// Auto-hide the editor's scrollbar: the thumb is transparent while the
// editor is at rest and fades in while scrolling. Works with the
// `.-auto-hide-scrollbar` CSS in the desktop app's main.scss.
const autoHideScrollbarExtension = () => {
	let hideTimeout: ReturnType<typeof setTimeout> | null = null;

	return EditorView.domEventHandlers({
		scroll: (event) => {
			const target = event.target as HTMLElement;
			if (!target || !target.classList) return false;

			// The scroll event may fire on the scroller or on nested
			// scrollable elements. Only the scroller has the scrollbar.
			if (!target.classList.contains('cm-scroller')) return false;

			target.classList.add('-auto-hide-scrollbar', '-scrolling');
			if (hideTimeout) clearTimeout(hideTimeout);
			hideTimeout = setTimeout(() => {
				target.classList.remove('-scrolling');
			}, 600);

			// Don't prevent the default scroll handler.
			return false;
		},
	});
};

export default autoHideScrollbarExtension;
