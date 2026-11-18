import { useEffect, useRef, MutableRefObject } from 'react';

// Adds a `-scrolling` class to the element while it is being scrolled (and
// removes it shortly after scrolling stops). Combined with the
// `.-auto-hide-scrollbar` CSS this fades the scrollbar thumb in and out.
export default function useAutoHideScrollbar(ref: MutableRefObject<HTMLElement | null>) {
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const element = ref.current;
		if (!element) return () => {};

		element.classList.add('-auto-hide-scrollbar');

		const markScrollingEnd = () => {
			element.classList.remove('-scrolling');
		};

		const onScroll = () => {
			element.classList.add('-scrolling');
			if (timerRef.current) clearTimeout(timerRef.current);
			// Keep the class for a moment after the last scroll event so that
			// the fade-out transition is visible.
			timerRef.current = setTimeout(markScrollingEnd, 600);
		};

		element.addEventListener('scroll', onScroll, { passive: true });
		return () => {
			element.removeEventListener('scroll', onScroll);
			if (timerRef.current) clearTimeout(timerRef.current);
			element.classList.remove('-auto-hide-scrollbar', '-scrolling');
		};
	// The ref is expected to be stable across renders.
	// eslint-disable-next-line @seiyab/react-hooks/exhaustive-deps
	}, []);
}
