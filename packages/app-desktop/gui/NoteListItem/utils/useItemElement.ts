import * as React from 'react';
import { Size } from '@joplin/utils/types';
import { useEffect, useRef } from 'react';
import { ItemFlow } from '@joplin/lib/services/plugins/api/noteListType';
import { ItemEventHandlers } from './types';
import attachNoteTitleTooltip from './noteTitleTooltip';
import { getCachedNoteHtml, setCachedNoteHtml } from './noteHtmlCache';

const applyItemLayout = (element: HTMLDivElement, style: React.CSSProperties, itemSize: Size, flow: ItemFlow) => {
	for (const [n, v] of Object.entries(style)) {
		(element.style as unknown as Record<string, unknown>)[n] = v;
	}
	if (flow === ItemFlow.LeftToRight) element.style.width = `${itemSize.width}px`;
	element.style.height = `${itemSize.height}px`;
};

const addItemEventListeners = (
	element: HTMLElement,
	listeners: ItemEventHandlers,
	onClick: React.MouseEventHandler<HTMLDivElement>,
	onDoubleClick: React.MouseEventHandler<HTMLDivElement>,
): { cleanup: ()=> void } => {
	const processedInputs: HTMLInputElement[] = [];
	const processedButtons: HTMLButtonElement[] = [];

	const inputs = element.getElementsByTagName('input');
	for (const input of inputs) {
		if (input.type === 'checkbox' || input.type === 'text') {
			input.addEventListener('change', listeners.onInputChange as unknown as EventListener);
			processedInputs.push(input);
		}
	}

	const buttons = element.getElementsByTagName('button');
	if (listeners.onClick) {
		for (const button of buttons) {
			button.addEventListener('click', listeners.onClick as unknown as EventListener);
			processedButtons.push(button);
		}
	}

	const clickHandler = (e: MouseEvent) => onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
	const dblclickHandler = (e: MouseEvent) => onDoubleClick(e as unknown as React.MouseEvent<HTMLDivElement>);
	element.addEventListener('click', clickHandler);
	element.addEventListener('dblclick', dblclickHandler);

	return {
		cleanup: () => {
			for (const input of processedInputs) {
				input.removeEventListener('change', listeners.onInputChange as unknown as EventListener);
			}
			if (listeners.onClick) {
				for (const button of processedButtons) {
					button.removeEventListener('click', listeners.onClick as unknown as EventListener);
				}
			}
			element.removeEventListener('click', clickHandler);
			element.removeEventListener('dblclick', dblclickHandler);
		},
	};
};

const useItemElement = (
	rootElement: HTMLDivElement | null, noteId: string, noteHtml: string, placeholderHtml: string, focusVisible: boolean, style: React.CSSProperties, itemSize: Size, onClick: React.MouseEventHandler<HTMLDivElement>, onDoubleClick: React.MouseEventHandler<HTMLDivElement>, flow: ItemFlow, itemEventHandlers: ItemEventHandlers, displayTitle = '',
) => {
	const itemElement = useRef<HTMLDivElement>(null);
	const layoutRef = useRef({ style, itemSize, flow });
	layoutRef.current = { style, itemSize, flow };

	// Effects are split so that re-creating the element (and re-writing
	// innerHTML) only happens when the rendered note HTML actually changes.
	// Scroll re-renders used to rebuild every visible DOM node on each pass.

	// Latest event handlers kept in a ref: the DOM is not rebuilt whenever a
	// handler identity changes.
	const handlersRef = useRef({ onClick, onDoubleClick, itemEventHandlers });
	handlersRef.current = { onClick, onDoubleClick, itemEventHandlers };

	// Read once at mount; the DOM is not rebuilt when these change (a separate
	// effect updates innerHTML).
	const mountContentRef = useRef({ noteHtml, placeholderHtml });
	mountContentRef.current = { noteHtml, placeholderHtml };

	useEffect(() => {
		if (!rootElement) return () => {};

		const element = document.createElement('div');
		element.setAttribute('data-id', noteId);
		element.className = 'note-list-item';

		// Fill synchronously on mount: previously-rendered HTML from the cache,
		// or a lightweight placeholder. Without this the item stayed empty until
		// the async render pipeline completed, which made fast scrolling flash
		// blank rows.
		element.innerHTML = mountContentRef.current.noteHtml ?? getCachedNoteHtml(noteId) ?? mountContentRef.current.placeholderHtml;
		applyItemLayout(element, layoutRef.current.style, layoutRef.current.itemSize, layoutRef.current.flow);

		rootElement.appendChild(element);
		itemElement.current = element;

		return () => {
			itemElement.current = null;
			element.remove();
		};
	}, [rootElement, noteId]);

	// Style is applied separately so that changing it (e.g. the item height
	// when the list renderer changes) does not re-create the DOM node.
	useEffect(() => {
		const element = itemElement.current;
		if (!element) return;
		applyItemLayout(element, style, itemSize, flow);
		// rootElement/noteId: the node is created in an earlier effect. Without
		// these deps the height stays unset until a later resize recreates itemSize.
	}, [style, itemSize, flow, rootElement, noteId]);

	useEffect(() => {
		if (!noteHtml) return;
		const element = itemElement.current;
		if (!element) return;
		setCachedNoteHtml(noteId, noteHtml);
		if (element.innerHTML !== noteHtml) element.innerHTML = noteHtml;
	}, [noteHtml, noteId]);

	useEffect(() => {
		const element = itemElement.current;
		if (!element) return undefined;
		const { cleanup } = addItemEventListeners(element, handlersRef.current.itemEventHandlers, handlersRef.current.onClick, handlersRef.current.onDoubleClick);
		return cleanup;
	}, [rootElement, noteId, noteHtml, flow]);

	useEffect(() => {
		const element = itemElement.current;
		if (!element) return undefined;
		const detachTooltip = displayTitle ? attachNoteTitleTooltip(element, displayTitle) : null;
		return () => {
			if (detachTooltip) detachTooltip();
		};
	}, [displayTitle, rootElement, noteId, noteHtml, flow]);

	useEffect(() => {
		const element = itemElement.current;
		if (!element) return;
		if (focusVisible) {
			element.classList.add('-focus-visible');
		} else {
			element.classList.remove('-focus-visible');
		}
	}, [focusVisible]);

	return itemElement;
};

export default useItemElement;
