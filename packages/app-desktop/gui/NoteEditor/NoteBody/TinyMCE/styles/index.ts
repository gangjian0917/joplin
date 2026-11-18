import { ThemeAppearance } from '@joplin/lib/themes/type';
import { NoteBodyEditorProps } from '../../../utils/types';
import { buildStyle } from '@joplin/lib/theme';

export default function styles(props: NoteBodyEditorProps) {
	const leftButtonCount = props.watchedNoteFiles.length > 0 ? 3 : 2;
	return buildStyle(['TinyMCE', props.style.width, props.style.height, leftButtonCount], props.themeId, theme => {
		const leftPadding = Math.max(4, theme.editorPaddingLeft - 4);
		const leftExtraToolbarContainerWidth = leftPadding + leftButtonCount * theme.toolbarHeight + (leftButtonCount - 1) * 2 + 4;
		const rightExtraToolbarContainerWidth = 82;
		const extraToolbarContainer = {
			boxSizing: 'content-box',
			backgroundColor: theme.backgroundColor3,
			borderTop: `1px solid ${theme.dividerColor}`,
			display: 'flex',
			flexDirection: 'row',
			alignItems: 'center',
			position: 'absolute',
			height: theme.toolbarHeight,
			zIndex: 2,
			top: 0,
			paddingTop: theme.toolbarPadding,
			paddingBottom: theme.toolbarPadding,
		};

		return {
			disabledOverlay: {
				zIndex: 10,
				position: 'absolute',
				backgroundColor: theme.backgroundColor,
				opacity: theme.appearance === ThemeAppearance.Light ? 0.7 : 0.9,
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				padding: 20,
				paddingTop: 50,
				textAlign: 'center',
				width: '100%',
			},
			rootStyle: {
				position: 'relative',
				marginLeft: -theme.editorPaddingLeft,
				width: `calc(${props.style.width} + ${theme.editorPaddingLeft}px)`,
				height: props.style.height,
			},
			leftExtraToolbarContainer: {
				...extraToolbarContainer,
				width: leftExtraToolbarContainerWidth - leftPadding - 4,
				paddingLeft: leftPadding,
				paddingRight: 4,
				gap: 2,
				left: 0,
			},
			rightExtraToolbarContainer: {
				...extraToolbarContainer,
				justifyContent: 'flex-end',
				width: rightExtraToolbarContainerWidth - 20,
				right: 0,
				paddingLeft: 6,
				paddingRight: 14,
			},
			extraToolbarButton: {
				display: 'flex',
				border: 'none',
				background: 'none',
			},
			extraToolbarButtonIcon: {
				fontSize: theme.toolbarIconSize,
				color: theme.color3,
			},
		};
	});
}
