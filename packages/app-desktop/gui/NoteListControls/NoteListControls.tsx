import { AppState } from '../../app.reducer';
import * as React from 'react';
import { useEffect, useRef, useContext } from 'react';
import SearchBar, { SearchBarHandle } from '../SearchBar/SearchBar';
import Button, { ButtonLevel, ButtonSize, buttonSizePx } from '../Button/Button';
import CommandService from '@joplin/lib/services/CommandService';
import { runtime as focusSearchRuntime } from './commands/focusSearch';
import Note from '@joplin/lib/models/Note';
import { notesSortOrderNextField } from '@joplin/lib/services/sortOrder/notesSortOrderUtils';
import { connect } from 'react-redux';
import styled from 'styled-components';
import stateToWhenClauseContext from '../../services/commands/stateToWhenClauseContext';
import { getTrashFolderId } from '@joplin/lib/services/trash';
import { Breakpoints } from '../NoteList/utils/types';
import { stateUtils } from '@joplin/lib/reducer';
import { WindowIdContext } from '../NewWindowOrIFrame';

interface Props {
	showNewNoteButtons: boolean;
	sortOrderButtonsVisible: boolean;
	sortOrderField: string;
	sortOrderReverse: boolean;
	notesParentType: string;
	height: number;
	width: number;
	newNoteButtonEnabled: boolean;
	newTodoButtonEnabled: boolean;
	setNewNoteButtonElement: React.Dispatch<React.SetStateAction<Element>>;
	breakpoint: number;
	dynamicBreakpoints: Breakpoints;
	buttonSize: ButtonSize;
	padding: number;
}

interface StyleProps {
	theme: { backgroundColor3: string };
	padding?: number;
	size?: ButtonSize;
}

const StyledRoot = styled.div`
	box-sizing: border-box;
	display: flex;
	flex-direction: row;
	align-items: center;
	height: 44px;
	padding: 0 ${(props: StyleProps) => props.padding}px;
	background-color: ${(props: StyleProps) => props.theme.backgroundColor3};
	border-bottom: 1px solid var(--joplin-divider-color);
	column-gap: 4px;

	html.mac-hidden-titlebar & {
		-webkit-app-region: drag;
	}

	html.mac-hidden-titlebar & button,
	html.mac-hidden-titlebar & input,
	html.mac-hidden-titlebar & a,
	html.mac-hidden-titlebar & [role="button"] {
		-webkit-app-region: no-drag;
	}

	html.mac-hidden-titlebar:not(.is-fullscreen) .is-leftmost-pane & {
		padding-left: 78px;
	}
`;

const StyledIconButton = styled(Button)`
	width: 28px;
	height: 28px;
	min-height: 28px;
	max-height: 28px;
	min-width: 28px;
	padding: 0;
	border: none;
	border-radius: 6px;
	background-color: transparent;
	white-space: nowrap;

	.fa, .fas, .far {
		font-size: 13px;
		color: var(--joplin-color3);
	}

	&:not(:disabled):hover {
		background-color: var(--joplin-background-color-hover3);
	}

	&:not(:disabled):active {
		background-color: var(--joplin-background-color-active3);
		transform: scale(0.96);
	}
`;

const StyledPairButtonL = styled(Button)`
	border-radius: 6px 0 0 6px;
	border-color: var(--joplin-divider-color);
	background-color: var(--joplin-background-color);
	min-width: ${(props: StyleProps) => buttonSizePx(props)}px;
	max-width: ${(props: StyleProps) => buttonSizePx(props)}px;

	.icon {
		font-size: 12px;
		color: var(--joplin-color3);
	}

	&:not(:disabled):hover {
		background-color: var(--joplin-background-color-hover3);
	}
`;

const StyledPairButtonR = styled(Button)`
	min-width: 18px;
	padding: 0 5px;
	border-radius: 0 6px 6px 0;
	border-color: var(--joplin-divider-color);
	border-width: 1px 1px 1px 0;
	background-color: var(--joplin-background-color);
	width: auto;

	.icon {
		font-size: 11px;
		color: var(--joplin-color3);
	}

	&:not(:disabled):hover {
		background-color: var(--joplin-background-color-hover3);
	}
`;

const SortOrderButtonsContainer = styled.div`
  display: flex;
  flex-direction: row;
  flex: 0 0 auto;
  margin-left: 2px;
`;

function NoteListControls(props: Props) {
	const searchBarRef = useRef(null);
	const noteControlsRef = useRef(null);
	const searchBarHandleRef = useRef<SearchBarHandle | null>(null);

	useEffect(() => {
		CommandService.instance().registerRuntime('focusSearch', focusSearchRuntime(searchBarRef, () => searchBarHandleRef.current?.expand()));

		return function() {
			CommandService.instance().unregisterRuntime('focusSearch');
		};
	}, []);

	function onNewTodoButtonClick() {
		void CommandService.instance().execute('newTodo');
	}

	function onNewNoteButtonClick() {
		void CommandService.instance().execute('newNote');
	}

	function onSortOrderFieldButtonClick() {
		void CommandService.instance().execute('toggleNotesSortOrderField');
	}

	function onSortOrderReverseButtonClick() {
		void CommandService.instance().execute('toggleNotesSortOrderReverse');
	}

	function sortOrderFieldTooltip() {
		const term1 = CommandService.instance().label('toggleNotesSortOrderField');
		const field = props.sortOrderField;
		const term2 = Note.fieldToLabel(field);
		const term3 = Note.fieldToLabel(notesSortOrderNextField(field));
		return `${term1}:\n ${term2} -> ${term3}`;
	}

	function sortOrderFieldIcon() {
		const defaultIcon = 'fas fa-cog';

		const field = props.sortOrderField;
		const iconMap: Record<string, string> = {
			user_updated_time: 'far fa-calendar-alt',
			user_created_time: 'far fa-calendar-plus',
			title: 'fas fa-font',
			order: 'fas fa-wrench',
			todo_due: 'fas fa-calendar-check',
			todo_completed: 'fas fa-check',
		};
		return `${iconMap[field] || defaultIcon} ${field}`;
	}

	function sortOrderReverseIcon() {
		return props.sortOrderReverse ? 'fas fa-long-arrow-alt-up' : 'fas fa-long-arrow-alt-down';
	}

	function showsSortOrderButtons() {
		let visible = props.sortOrderButtonsVisible;
		if (props.notesParentType === 'Search') visible = false;
		return visible;
	}

	function renderNewNoteButtons() {
		if (!props.showNewNoteButtons) return null;

		return (
			<>
				<StyledIconButton
					ref={(el: Element) => {
						props.setNewNoteButtonElement(el);
					}}
					className="new-note-button"
					tooltip={CommandService.instance().label('newNote')}
					iconName='fas fa-pen'
					level={ButtonLevel.Tertiary}
					size={props.buttonSize}
					onClick={onNewNoteButtonClick}
					disabled={!props.newNoteButtonEnabled}
				/>
				<StyledIconButton
					className="new-todo-button"
					tooltip={CommandService.instance().label('newTodo')}
					iconName='far fa-check-square'
					level={ButtonLevel.Tertiary}
					size={props.buttonSize}
					onClick={onNewTodoButtonClick}
					disabled={!props.newTodoButtonEnabled}
				/>
			</>
		);
	}

	const windowId = useContext(WindowIdContext);
	return (
		<StyledRoot ref={noteControlsRef} padding={props.padding}>
			{renderNewNoteButtons()}
			{showsSortOrderButtons() &&
				<SortOrderButtonsContainer>
					<StyledPairButtonL
						className="sort-order-field-button"
						tooltip={sortOrderFieldTooltip()}
						iconName={sortOrderFieldIcon()}
						level={ButtonLevel.Secondary}
						size={props.buttonSize}
						onClick={onSortOrderFieldButtonClick}
					/>
					<StyledPairButtonR
						className="sort-order-reverse-button"
						tooltip={CommandService.instance().label('toggleNotesSortOrderReverse')}
						iconName={sortOrderReverseIcon()}
						level={ButtonLevel.Secondary}
						size={props.buttonSize}
						onClick={onSortOrderReverseButtonClick}
					/>
				</SortOrderButtonsContainer>
			}
			<SearchBar inputRef={searchBarRef} windowId={windowId} searchBarHandleRef={searchBarHandleRef}/>
		</StyledRoot>
	);
}

interface ConnectProps {
	windowId: string;
}

const mapStateToProps = (state: AppState, ownProps: ConnectProps) => {
	const whenClauseContext = stateToWhenClauseContext(state, { windowId: ownProps.windowId });
	const windowState = stateUtils.windowStateById(state, ownProps.windowId);
	const hasFolderForNewNotes = whenClauseContext.selectedFolderIsValid
		&& windowState.selectedFolderId !== getTrashFolderId();

	return {
		showNewNoteButtons: hasFolderForNewNotes,
		newNoteButtonEnabled: CommandService.instance().isEnabled('newNote', whenClauseContext),
		newTodoButtonEnabled: CommandService.instance().isEnabled('newTodo', whenClauseContext),
		sortOrderButtonsVisible: state.settings['notes.sortOrder.buttonsVisible'],
		sortOrderField: state.settings['notes.sortOrder.field'],
		sortOrderReverse: state.settings['notes.sortOrder.reverse'],
		notesParentType: windowState.notesParentType,
	};
};

export default connect(mapStateToProps)(NoteListControls);
