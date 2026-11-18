import { Dispatch } from 'redux';
import Folder from './models/Folder';
import Setting from './models/Setting';
import shim from './shim';
import { FolderLoadOptions } from './models/utils/types';

const refreshCalls_: boolean[] = [];
let scheduleRefreshFoldersIID_: ReturnType<typeof shim.setTimeout> = null;

// Minimum quiet time between two full folder-count recomputes (ms). See
// scheduleRefreshFolders.
const MIN_REFRESH_INTERVAL_ = 5000;
let lastRefreshFoldersTime_ = 0;

export const allForDisplay = async (options: FolderLoadOptions = {}) => {
	const orderDir = Setting.value('folders.sortOrder.reverse') ? 'DESC' : 'ASC';

	const folderOptions: FolderLoadOptions = {
		caseInsensitive: true,
		order: [
			{
				by: 'title',
				dir: orderDir,
			},
		],
		...options,
	};

	let folders = await Folder.all(folderOptions);

	if (Setting.value('folders.sortOrder.field') === 'last_note_user_updated_time') {
		folders = await Folder.orderByLastModified(folders, orderDir);
	}

	if (Setting.value('showNoteCounts')) {
		await Folder.addNoteCounts(folders,
			Setting.value('showCompletedTodos'));
	}

	return folders;
};

// `selectedFolderId` should be the currently selected folder. Set it to an empty string if that
// information is not available in the current context.
export const refreshFolders = async (dispatch: Dispatch, selectedFolderId: string) => {
	refreshCalls_.push(true);
	try {
		const folders = await allForDisplay({
			includeConflictFolder: true,
			includeTrash: true,
		});

		dispatch({
			type: 'FOLDER_UPDATE_ALL',
			items: folders,
		});

		// If the currently selected folder no longer exists and a smart filter is not set, select a default folder
		const notesParent = Setting.value('notesParent');
		if ((!notesParent || JSON.parse(notesParent).type !== 'SmartFilter') && selectedFolderId && !folders.find(f => f.id === selectedFolderId)) {
			const defaultFolder = await Folder.defaultFolder();
			if (defaultFolder) {
				dispatch({
					type: 'FOLDER_SELECT',
					id: defaultFolder.id,
				});
			}
		}
	} finally {
		refreshCalls_.pop();
	}
};

export const scheduleRefreshFolders = async (dispatch: Dispatch, selectedFolderId: string) => {
	if (scheduleRefreshFoldersIID_) shim.clearTimeout(scheduleRefreshFoldersIID_);
	// During sync or other bulk operations, many NOTE_UPDATE_ONE actions fire in
	// a row. The debounce coalesces them, but each completion used to rearm a
	// new 1s timer immediately, so a long sync recomputed all folder counts
	// once per second for its whole duration. Enforce a minimum quiet period
	// between full recomputes: requests arriving within the window are deferred
	// to its end, not dropped.
	const sinceLast = Date.now() - lastRefreshFoldersTime_;
	const delay = sinceLast < MIN_REFRESH_INTERVAL_ ? MIN_REFRESH_INTERVAL_ - sinceLast : 1000;
	scheduleRefreshFoldersIID_ = shim.setTimeout(() => {
		scheduleRefreshFoldersIID_ = null;
		lastRefreshFoldersTime_ = Date.now();
		void refreshFolders(dispatch, selectedFolderId);
	}, delay);
};

export const cancelTimers = async () => {
	if (scheduleRefreshFoldersIID_) {
		shim.clearTimeout(scheduleRefreshFoldersIID_);
		scheduleRefreshFoldersIID_ = null;
	}
	return new Promise((resolve) => {
		const iid = shim.setInterval(() => {
			if (!refreshCalls_.length) {
				shim.clearInterval(iid);
				resolve(null);
			}
		}, 100);
	});
};
