import useVisibleRange from './useVisibleRange';
import { renderHook } from '@testing-library/react';
import { Size } from '@joplin/utils/types';

describe('useVisibleRange', () => {

	test('should calculate indexes', () => {

		// IN: itemsPerLine, scrollTop, listSize, itemSize, noteCount
		//
		// OUT: [startNoteIndex, endNoteIndex, startLineIndex, endLineIndex, totalLineCount, visibleItemCount]
		//
		// startNoteIndex/endNoteIndex cover the visible lines extended by
		// OVERSCAN_LINES above and below (clamped to the note count); the line
		// indexes describe the strictly visible window.

		const testCases: [number, number, Size, Size, number, ReturnType<typeof useVisibleRange>][] = [
			[
				1,
				150,
				{ width: 100, height: 400 },
				{ width: 100, height: 100 },
				8,
				[0, 7, 1, 5, 8, 5],
			],
			[
				2,
				100,
				{ width: 220, height: 380 },
				{ width: 100, height: 100 },
				12,
				[0, 11, 1, 4, 6, 8],
			],
			[
				2,
				50,
				{ width: 220, height: 300 },
				{ width: 100, height: 100 },
				9,
				[0, 8, 0, 3, 5, 8],
			],
			[
				4,
				0,
				{ width: 410, height: 450 },
				{ width: 100, height: 100 },
				30,
				[0, 29, 0, 4, 8, 20],
			],
		];

		for (const [scrollTop, listSize, itemSize, noteCount, flow, expected] of testCases) {
			const { result } = renderHook(() => useVisibleRange(
				scrollTop,
				listSize,
				itemSize,
				noteCount,
				flow,
			));

			expect(result.current).toEqual(expected);
		}
	});

});
