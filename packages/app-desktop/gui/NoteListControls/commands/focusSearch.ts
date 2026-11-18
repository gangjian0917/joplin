import { CommandRuntime, CommandDeclaration } from '@joplin/lib/services/CommandService';
import { _ } from '@joplin/lib/locale';

export const declaration: CommandDeclaration = {
	name: 'focusSearch',
	label: () => _('Search in all the notes'),
};

// onExpand is called when the search bar is collapsed — it expands it, which
// mounts the input and focuses it (see SearchBar's useEffect). When already
// expanded, select() the existing input.
export const runtime = (searchBarRef: { current: { select: ()=> void } | null }, onExpand: ()=> void): CommandRuntime => {
	return {
		execute: async () => {
			if (searchBarRef.current) {
				searchBarRef.current.select();
			} else {
				onExpand();
			}
		},
	};
};
