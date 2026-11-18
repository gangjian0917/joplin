import * as React from 'react';
import { StyledAllNotesIcon, StyledListItemAnchor, StyledSpanFix } from '../styles';
import { useCallback } from 'react';
import { Dispatch } from 'redux';
import bridge from '../../../services/bridge';
import Setting from '@joplin/lib/models/Setting';
import MenuUtils from '@joplin/lib/services/commands/MenuUtils';
import CommandService from '@joplin/lib/services/CommandService';
import PerFolderSortOrderService from '@joplin/lib/services/sortOrder/PerFolderSortOrderService';
import { connect } from 'react-redux';
import EmptyExpandLink from './EmptyExpandLink';
import ListItemWrapper, { ItemSelectionState, ListItemRef } from './ListItemWrapper';
import { ListItem } from '../types';
import { ALL_NOTES_FILTER_ID } from '@joplin/lib/reserved-ids';

const Menu = bridge().Menu;
const MenuItem = bridge().MenuItem;

interface Props {
	dispatch: Dispatch;
	anchorRef: ListItemRef;
	selectionState: ItemSelectionState;
	item: ListItem;
	index: number;
	itemCount: number;
	isCompact?: boolean;
}

const menuUtils = new MenuUtils(CommandService.instance());

const AllNotesItem: React.FC<Props> = props => {
	const onAllNotesClick_ = useCallback(() => {
		props.dispatch({
			type: 'SMART_FILTER_SELECT',
			id: ALL_NOTES_FILTER_ID,
		});
	}, [props.dispatch]);

	const toggleAllNotesContextMenu = useCallback(() => {
		const menu = new Menu();

		if (Setting.value('notes.perFolderSortOrderEnabled')) {
			menu.append(new MenuItem({
				...menuUtils.commandToStatefulMenuItem('togglePerFolderSortOrder', ALL_NOTES_FILTER_ID),
				type: 'checkbox',
				checked: PerFolderSortOrderService.isSet(ALL_NOTES_FILTER_ID),
			}));
		}

		menu.popup({ window: bridge().activeWindow() });
	}, []);

	return (
		<ListItemWrapper
			containerRef={props.anchorRef}
			key="allNotesHeader"
			selectionState={props.selectionState}
			depth={props.item.depth}
			className={'list-item-container list-item-depth-0 all-notes'}
			highlightOnHover={true}
			itemIndex={props.index}
			itemCount={props.itemCount}
		>
			<EmptyExpandLink/>
			<StyledListItemAnchor
				className="list-item"
				isSpecialItem={false}
				selected={props.selectionState.selected}
				title={props.isCompact ? props.item.label : undefined}
				onClick={onAllNotesClick_}
				onContextMenu={toggleAllNotesContextMenu}
			>
				<StyledAllNotesIcon aria-hidden='true' role='img' className='icon-notes' selected={props.selectionState.selected}/>
				<StyledSpanFix className='title'>{props.item.label}</StyledSpanFix>
			</StyledListItemAnchor>
		</ListItemWrapper>
	);
};

export default connect()(AllNotesItem);
