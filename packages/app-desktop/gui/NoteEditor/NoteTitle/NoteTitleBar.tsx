import * as React from 'react';
import { _ } from '@joplin/lib/locale';
import CommandService from '@joplin/lib/services/CommandService';
import { ChangeEvent, useCallback, useContext, useRef } from 'react';
import NoteToolbar from '../../NoteToolbar/NoteToolbar';
import { macosNoteTitleFontSize } from '@joplin/lib/themes/macos';
import shim from '@joplin/lib/shim';
import { buildStyle } from '@joplin/lib/theme';
import { WindowIdContext } from '../../NewWindowOrIFrame';
import { EditorToolbarSlots } from '../EditorToolbarHost';

interface Props {
	themeId: number;
	contentMaxWidth: number;
	noteTitle: string;
	noteIsTodo: number;
	isProvisional: boolean;
	titleInputRef: React.RefObject<HTMLInputElement>;
	onTitleChange(event: ChangeEvent<HTMLInputElement>): void;
	disabled: boolean;
	onToolbarSlots(slots: EditorToolbarSlots): void;
}

function styles_(props: Props) {
	return buildStyle(['NoteEditorTitleBar'], props.themeId, theme => {
		return {
			titleInput: {
				flex: 1,
				display: 'inline-block',
				paddingTop: 4,
				minHeight: 32,
				boxSizing: 'border-box',
				paddingBottom: 4,
				paddingLeft: 0,
				paddingRight: 8,
				color: theme.textStyle.color,
				fontSize: shim.isMac() ? macosNoteTitleFontSize : Math.round(theme.textStyle.fontSize * 1.5),
				fontWeight: shim.isMac() ? 600 : 'bold',
				lineHeight: shim.isMac() ? 1.25 : undefined,
				backgroundColor: theme.backgroundColor,
				border: 'none',
				width: '100%',
			},

			toolbarStyle: {
				marginBottom: 0,
				minWidth: 0,
			},
		};
	});
}

const useReselectHandlers = () => {
	const lastTitleFocus = useRef([0, 0]);
	const lastTitleValue = useRef('');

	const onTitleBlur: React.FocusEventHandler<HTMLInputElement> = useCallback((event) => {
		const titleElement = event.currentTarget;
		lastTitleFocus.current = [titleElement.selectionStart, titleElement.selectionEnd];
		lastTitleValue.current = titleElement.value;
	}, []);

	const onTitleFocus: React.FocusEventHandler<HTMLInputElement> = useCallback((event) => {
		const titleElement = event.currentTarget;
		// By default, focusing the note title bar can cause its content to become selected. We override
		// this with a more reasonable default:
		if (titleElement.selectionStart === 0 && titleElement.selectionEnd === titleElement.value.length) {
			if (lastTitleValue.current !== titleElement.value) {
				titleElement.selectionStart = titleElement.value.length;
			} else {
				titleElement.selectionStart = lastTitleFocus.current[0];
				titleElement.selectionEnd = lastTitleFocus.current[1];
			}
		}
	}, []);

	return { onTitleBlur, onTitleFocus };
};

export default function NoteTitleBar(props: Props) {
	const styles = styles_(props);

	const onTitleKeydown: React.KeyboardEventHandler<HTMLInputElement> = useCallback((event) => {
		const titleElement = event.currentTarget;
		const selectionAtEnd = titleElement.selectionEnd === titleElement.value.length;
		const isNavigationShortcut = (event.key === 'ArrowDown' && selectionAtEnd) || (event.key === 'Enter' && !event.shiftKey);
		const composing = event.nativeEvent.isComposing;

		// Don't change focus if the navigation shortcut is fired during composition. See
		// https://github.com/laurent22/joplin/issues/11485.
		if (!composing && isNavigationShortcut) {
			event.preventDefault();
			const moveCursorToStart = event.key === 'ArrowDown';
			void CommandService.instance().execute('focusElement', 'noteBody', { moveCursorToStart });
		}
	}, []);

	const { onTitleFocus, onTitleBlur } = useReselectHandlers();

	const windowId = useContext(WindowIdContext);
	const slotsRef = useRef<EditorToolbarSlots>({ left: null, center: null, right: null });
	const onToolbarSlotsRef = useRef(props.onToolbarSlots);
	onToolbarSlotsRef.current = props.onToolbarSlots;

	const publishSlot = useCallback((key: keyof EditorToolbarSlots, node: HTMLDivElement | null) => {
		if (slotsRef.current[key] === node) return;
		slotsRef.current = { ...slotsRef.current, [key]: node };
		onToolbarSlotsRef.current({ ...slotsRef.current });
	}, []);
	const setLeftSlot = useCallback((node: HTMLDivElement | null) => publishSlot('left', node), [publishSlot]);
	const setCenterSlot = useCallback((node: HTMLDivElement | null) => publishSlot('center', node), [publishSlot]);
	const setRightSlot = useCallback((node: HTMLDivElement | null) => publishSlot('right', node), [publishSlot]);

	function renderNoteToolbar() {
		return <NoteToolbar
			themeId={props.themeId}
			style={styles.toolbarStyle}
			disabled={props.disabled}
			windowId={windowId}
		/>;
	}

	return (
		<div className='note-title-wrapper'>
			<div className='note-title-top-row'>
				<div className='note-editor-toolbar-host'>
					<div className='note-editor-toolbar-slot-left' ref={setLeftSlot}/>
					<div className='note-editor-toolbar-slot-center' ref={setCenterSlot}/>
					<div className='note-editor-toolbar-slot-right' ref={setRightSlot}/>
				</div>
				<div className='note-title-info-group'>
					{renderNoteToolbar()}
				</div>
			</div>
			<div
				className='note-title-input-row'
				style={props.contentMaxWidth ? { maxWidth: props.contentMaxWidth } : undefined}
			>
				<input
					className="title-input"
					type="text"
					ref={props.titleInputRef}
					placeholder={props.isProvisional ? (props.noteIsTodo ? _('Creating new to-do...') : _('Creating new note...')) : ''}
					aria-label={props.isProvisional ? undefined : _('Note title')}
					style={styles.titleInput}
					readOnly={props.disabled}
					onChange={props.onTitleChange}
					onKeyDown={onTitleKeydown}
					onFocus={onTitleFocus}
					onBlur={onTitleBlur}
					value={props.noteTitle}
				/>
			</div>
		</div>
	);
}
