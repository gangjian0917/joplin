import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
	test('opens the collapsed search bar even if the global focus state is stale', () => {
		const dispatch = jest.fn();
		const props = {
			notesParentType: 'Notebook',
			dispatch,
			selectedNoteId: '',
			isFocused: false,
		};
		const view = render(<SearchBar {...props}/>);

		view.rerender(<SearchBar {...props} isFocused={true}/>);
		fireEvent.click(screen.getByRole('button', { name: 'Search' }));

		expect(screen.getByRole('searchbox')).toBeTruthy();
		expect(dispatch).toHaveBeenCalledWith({ type: 'FOCUS_SET', field: 'globalSearch' });
	});

	test('keeps the search bar open when the query is cleared', () => {
		const props = {
			notesParentType: 'Notebook',
			dispatch: jest.fn(),
			selectedNoteId: '',
			isFocused: false,
		};
		render(<SearchBar {...props}/>);

		fireEvent.click(screen.getByRole('button', { name: 'Search' }));
		const input = screen.getByRole('searchbox');
		fireEvent.change(input, { target: { value: 'query' } });
		fireEvent.change(input, { target: { value: '' } });

		const clearedInput = screen.getByRole('searchbox') as HTMLInputElement;
		expect(clearedInput.value).toBe('');
	});
});
