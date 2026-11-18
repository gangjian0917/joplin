import { ThemeStyle, buildStyle } from '@joplin/lib/theme';
import { NoteBodyEditorProps } from '../../../utils/types';
import { useMemo } from 'react';



const useStyles = (props: NoteBodyEditorProps) => {
	return useMemo(() => {
		return buildStyle([
			'CodeMirror', props.fontSize, props.contentMaxWidth,
		], props.themeId, (theme: ThemeStyle) => {
			return {
				root: {
					position: 'relative',
					display: 'flex',
					flexDirection: 'column',
					minHeight: 0,
					...props.style,
				},
				rowToolbar: {
					position: 'relative',
					display: 'flex',
					flexDirection: 'row',
					alignItems: 'center',
					marginLeft: -theme.editorPaddingLeft,
					backgroundColor: theme.backgroundColor3,
					borderTop: `1px solid ${theme.dividerColor}`,
					borderBottom: `1px solid ${theme.dividerColor}`,
				},
				viewer: {
					display: 'flex',
					overflow: 'hidden',
					verticalAlign: 'top',
					boxSizing: 'border-box',
					width: '100%',
				},
				editor: {
					display: 'flex',
					width: 'auto',
					height: 'auto',
					flex: 1,
					overflowY: 'hidden',
					paddingTop: 0,
					lineHeight: `${Math.round(17 * props.fontSize / 12)}px`,
					fontSize: `${props.fontSize}px`,
					color: theme.color,
					backgroundColor: theme.backgroundColor,

					// CM5 only
					codeMirrorTheme: theme.codeMirrorTheme, // Defined in theme.js
				},

				// CM6 only
				globalTheme: {
					...theme,
					contentMaxWidth: props.contentMaxWidth ? `${props.contentMaxWidth}px` : undefined,
					fontFamily: 'inherit',
					fontSize: props.fontSize,
					fontSizeUnits: 'px',
					isDesktop: true,
				},
			};
		});
	}, [props.style, props.themeId, props.fontSize, props.contentMaxWidth]);
};
export default useStyles;
