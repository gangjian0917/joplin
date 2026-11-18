const styled = require('styled-components').default;
const Color = require('color');

interface StyleProps {
	theme: {
		color: string;
		color3: string;
		colorFaded: string;
		fontSize: number;
		toolbarHeight: number;
		backgroundColor4: string;
	};
}

const StyledInput = styled.input`
	border: 1px solid ${(props: StyleProps) => Color(props.theme.color3).alpha(0.22)};
	border-radius: 7px;
	font-size: ${(props: StyleProps) => props.theme.fontSize}px;
	color: ${(props: StyleProps) => props.theme.color};
	padding: 0 9px;
	height: ${(props: StyleProps) => `${props.theme.toolbarHeight}px`};
	max-height: ${(props: StyleProps) => `${props.theme.toolbarHeight}px`};
	box-sizing: border-box;
	background-color: ${(props: StyleProps) => Color(props.theme.backgroundColor4).alpha(0.65)};
	transition: background-color 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;

	&::placeholder {
		color: ${(props: StyleProps) => props.theme.colorFaded};
	}

	&:focus {
		outline: none;
		background-color: ${(props: StyleProps) => props.theme.backgroundColor4};
		border: 1px solid var(--joplin-focus-outline-color);
		box-shadow: 0 0 0 2.5px color-mix(in srgb, var(--joplin-focus-outline-color) 28%, transparent);
	}
`;

export default StyledInput;
