import shim from '@joplin/lib/shim';
import Button from '../../Button/Button';
import styled, { css } from 'styled-components';

interface StyleProps {
	theme: {
		backgroundColor2: string;
		backgroundColor: string;
		backgroundColorHover2: string;
		color2: string;
		selectedColor2: string;
		sidebarSelectedBackgroundColor?: string;
		sidebarSelectedTextColor?: string;
		color4: string;
		colorError2: string;
		colorFaded2: string;
		colorPublished2: string;
		colorWarn2: string;
		topRowHeight: number;
		mainPadding: number;
		fontSize: number;
		toolbarIconSize: number;
	};
	isConflictFolder?: boolean;
	isSpecialItem?: boolean;
	isPublished?: boolean;
	shareId?: string;
	selected?: boolean;
}

export const StyledRoot = styled.div`
	background-color: ${(props: StyleProps) => props.theme.backgroundColor2};
	border-right: 1px solid var(--joplin-divider-color);
	box-sizing: border-box;
	width: 100%;
	height: 100%;
	overflow-x: hidden;
	overflow-y: hidden;
	display: inline-flex;
	flex-direction: column;
`;

export const StyledHeader = styled.div`
	flex: 1;
	box-sizing: border-box;
	padding: ${(props: StyleProps) => props.theme.mainPadding}px;
	padding-top: 6px;
	padding-bottom: 6px;
	display: flex;
	align-items: center;
	user-select: none;
	text-transform: uppercase;
	cursor: default;
	transition: background 0.15s ease;
	&:hover {
		background: ${(props: StyleProps) => props.theme.backgroundColorHover2};
	}
`;

export const StyledHeaderIcon = styled.i`
	font-size: 13px;
	color: ${(props: StyleProps) => shim.isMac() ? props.theme.colorFaded2 : props.theme.color2};
	margin-right: 7px;
`;

export const StyledAllNotesIcon = styled(StyledHeaderIcon)`
	font-size: 13px;
	color: ${(props: StyleProps) => {
		if (props.selected && usesAccentSelection(props)) return '#ffffff';
		return shim.isMac() ? props.theme.selectedColor2 : props.theme.colorFaded2;
	}};
	margin-right: 7px;
`;

const usesAccentSelection = (props: StyleProps) => {
	const selected = (props.theme.sidebarSelectedBackgroundColor || props.theme.selectedColor2 || '').toLowerCase();
	return selected === '#007aff' || selected === '#0a84ff';
};

export const StyledHeaderLabel = styled.span`
	flex: 1;
	color: ${(props: StyleProps) => shim.isMac() ? props.theme.colorFaded2 : props.theme.color2};
	font-size: ${(props: StyleProps) => shim.isMac() ? 11 : Math.round(props.theme.fontSize * 1.1)}px;
	font-weight: ${shim.isMac() ? 600 : 'bold'};
	letter-spacing: normal;
`;

function listItemTextColor(props: StyleProps) {
	if (props.selected && usesAccentSelection(props)) return '#ffffff';
	if (props.isConflictFolder) return props.theme.colorError2;
	if (props.selected && props.theme.sidebarSelectedTextColor) return props.theme.sidebarSelectedTextColor;
	if (props.isSpecialItem) return props.theme.colorFaded2;
	if (props.selected && props.isPublished) return props.theme.color2;
	if (props.isPublished) return props.theme.colorPublished2;
	if (props.shareId) return props.theme.colorWarn2;
	return props.theme.color2;
}

export const StyledListItemAnchor = styled.a`
	font-size: ${(props: StyleProps) => shim.isMac() ? props.theme.fontSize : Math.round(props.theme.fontSize * 1.0833333)}px;
	font-weight: ${(props: StyleProps) => shim.isMac() ? 400 : props.selected ? 600 : 400};
	letter-spacing: normal;
	text-decoration: none;
	color: ${(props: StyleProps) => listItemTextColor(props)};
	cursor: default;
	opacity: ${(props: StyleProps) => {
		if (shim.isMac()) return 1;
		// So that the conflicts folder and shared folders have sufficient contrast,
		// use an opacity of 1 even when unselected.
		const needsHigherContrast = props.isConflictFolder || props.isSpecialItem;
		return (props.selected || props.shareId || props.isPublished || needsHigherContrast) ? 1 : 0.8;
	}};
	white-space: nowrap;
	display: flex;
	flex: 1;
	min-width: 0;
	overflow: hidden;
	align-items: center;
	user-select: none;
	height: 100%;

	> .title,
	> .tag-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	> .note-count-label {
		color: ${(props: StyleProps) => (props.selected && usesAccentSelection(props)) ? 'rgba(255, 255, 255, 0.85)' : props.theme.colorFaded2};
	}

	/* A different background color is already used to indicate focus for sidebar list items. */
	&:focus-visible {
		outline: none;
	}
`;

export const StyledShareIcon = styled.i`
	margin-left: 8px;
`;

export const StyledSynchronizeButton = styled(Button)``;

export const StyledAddButton = styled(Button)`
	border: none;
	padding-right: 15px;
	padding-top: 4px;
`;

export const StyledSyncReport = styled.div`
	font-size: ${(props: StyleProps) => Math.round(props.theme.fontSize * 0.9)}px;
	color: ${(props: StyleProps) => props.theme.color2};
	opacity: 0.5;
	display: flex;
	flex-direction: column;
	align-self: stretch;
	margin-left: 5px;
	margin-right: 5px;
	margin-bottom: 10px;
	word-wrap: break-word;
`;

export const StyledSyncReportText = styled.div`
	color: ${(props: StyleProps) => props.theme.color2};
	word-wrap: break-word;
	width: 100%;
`;

// Workaround sidebar rendering bug on Linux Intel GPU.
// https://github.com/laurent22/joplin/issues/7506
export const StyledSpanFix = styled.span`
	${shim.isLinux() && css`
		position: relative;
	`}
`;
