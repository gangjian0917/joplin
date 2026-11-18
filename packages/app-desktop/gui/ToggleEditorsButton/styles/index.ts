import { Props, Value } from '../ToggleEditorsButton';
import { buildStyle } from '@joplin/lib/theme';
import { CSSProperties } from 'react';

export default function styles(props: Props) {
	return buildStyle(['ToggleEditorsButton', props.value], props.themeId, theme => {
		const iconSize = 13;
		const segmentWidth = 28;
		const segmentHeight = 18;

		const innerButton: CSSProperties = {
			border: 'none',
			borderRadius: 5,
			width: segmentWidth,
			height: segmentHeight,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			transition: 'background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease',
		};

		const output: Record<string, CSSProperties> = {
			button: {
				border: `1px solid ${theme.dividerColor}`,
				borderRadius: 7,
				padding: 2,
				height: 24,
				boxSizing: 'border-box',
				display: 'flex',
				flexDirection: 'row',
				alignItems: 'center',
				gap: 2,
				backgroundColor: theme.backgroundColorHover3,
				cursor: 'pointer',
			},
			leftInnerButton: {
				...innerButton,
			},
			rightInnerButton: {
				...innerButton,
			},
			leftIcon: {
				fontSize: iconSize,
				color: theme.color3,
			},
			rightIcon: {
				fontSize: iconSize - 1,
				color: theme.color3,
			},
		};

		if (props.value === Value.Markdown) {
			output.leftInnerButton.backgroundColor = theme.backgroundColor;
			output.leftInnerButton.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.12)';
			output.leftIcon.color = theme.color;
			output.rightInnerButton.backgroundColor = 'transparent';
			output.rightInnerButton.opacity = 0.55;
		} else if (props.value === Value.RichText) {
			output.rightInnerButton.backgroundColor = theme.backgroundColor;
			output.rightInnerButton.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.12)';
			output.rightIcon.color = theme.color;
			output.leftInnerButton.backgroundColor = 'transparent';
			output.leftInnerButton.opacity = 0.55;
		}

		return output;
	});
}
