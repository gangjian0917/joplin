import { createContext } from 'react';

export interface EditorToolbarSlots {
	left: HTMLDivElement | null;
	center: HTMLDivElement | null;
	right: HTMLDivElement | null;
}

export const emptyEditorToolbarSlots: EditorToolbarSlots = {
	left: null,
	center: null,
	right: null,
};

export const EditorToolbarHostContext = createContext<EditorToolbarSlots>(emptyEditorToolbarSlots);
