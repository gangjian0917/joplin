import { act, renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import useScroll from './useScroll';

describe('useScroll', () => {
	test('checks item visibility against the element scroll position', () => {
		const listRef: MutableRefObject<HTMLDivElement> = {
			current: document.createElement('div'),
		};
		listRef.current.scrollTop = 100;

		const { result } = renderHook(() => useScroll(
			1,
			20,
			{ width: 100, height: 20 },
			{ width: 100, height: 200 },
			listRef,
		));

		act(() => result.current.makeItemIndexVisible(12));

		expect(listRef.current.scrollTop).toBe(100);
		expect(result.current.scrollTop).toBe(100);
	});
});
