import theme_light from './themes/light';
import theme_dark from './themes/dark';
import theme_dracula from './themes/dracula';
import theme_solarizedLight from './themes/solarizedLight';
import theme_solarizedDark from './themes/solarizedDark';
import theme_nord from './themes/nord';
import theme_aritimDark from './themes/aritimDark';
import theme_oledDark from './themes/oledDark';
import Setting from './models/Setting';
import shim from './shim';
import { applyMacosTheme, macosBodyFontSize, macosFontFamily, macosSecondaryFontSize, macosUiFontSize } from './themes/macos';
import { Theme, ThemeAppearance } from './themes/type';

const Color = require('color');

const themes: Record<number, Theme> = {
	[Setting.THEME_LIGHT]: theme_light,
	[Setting.THEME_DARK]: theme_dark,
	[Setting.THEME_DRACULA]: theme_dracula,
	[Setting.THEME_SOLARIZED_LIGHT]: theme_solarizedLight,
	[Setting.THEME_SOLARIZED_DARK]: theme_solarizedDark,
	[Setting.THEME_NORD]: theme_nord,
	[Setting.THEME_ARITIM_DARK]: theme_aritimDark,
	[Setting.THEME_OLED_DARK]: theme_oledDark,
};

export function themeById(themeId: number) {
	if (!themes[themeId]) throw new Error(`Invalid theme ID: ${themeId}`);
	return { ...themes[themeId] };
}

const literal = <T extends string> (str: T): T => str;

// globalStyle should be used for properties that do not change across themes
// i.e. should not be used for colors
const globalStyle = (() => {
	const mac = shim.isMac();

	const margin = mac ? 16 : 15; // No text and no interactive component should be within this margin
	const fontFamily = mac ? macosFontFamily : 'Roboto';
	return {
		fontFamily: fontFamily,
		itemMarginTop: 10,
		itemMarginBottom: 10,
		disabledOpacity: 0.3,
		buttonMinWidth: 50,
		buttonMinHeight: mac ? 22 : 30,
		editorFontSize: mac ? macosBodyFontSize : 12,
		textAreaLineHeight: mac ? 22 : 17,
		lineHeight: mac ? '1.4' : '1.6em',
		headerButtonHPadding: 6,
		toolbarHeight: mac ? 28 : 26,
		toolbarPadding: 6,
		appearance: ThemeAppearance.Light,
		mainPadding: mac ? 10 : 12,
		topRowHeight: mac ? 44 : 50,
		editorPaddingLeft: mac ? 20 : 8,
		listTabSize: '1.7em',

		margin: margin,
		marginRight: margin,
		marginLeft: margin,
		marginTop: margin,
		marginBottom: margin,

		icon: { fontSize: 30 },
		lineInput: {
			fontFamily,
			maxHeight: 22,
			height: 22,
			paddingLeft: 5,
		},
		headerStyle: {
			fontFamily,
		},
		inputStyle: {
			border: '1px solid',
			height: mac ? 22 : 24,
			maxHeight: mac ? 22 : 24,
			paddingLeft: mac ? 8 : 5,
			paddingRight: mac ? 8 : 5,
			boxSizing: literal('border-box'),
			...(mac ? { borderRadius: 6 } : {}),
		},
		containerStyle: {
			overflow: literal('auto'),
			overflowY: literal('auto'),
		},
		buttonStyle: {
			// marginRight: 10,
			border: '1px solid',
			minHeight: mac ? 22 : 26,
			minWidth: 80,
			// maxWidth: 220,
			paddingLeft: mac ? 14 : 12,
			paddingRight: mac ? 14 : 12,
			paddingTop: mac ? 2 : 6,
			paddingBottom: mac ? 2 : 6,
			// boxShadow: '0px 1px 1px rgba(0,0,0,0.3)',
			borderRadius: mac ? 6 : 4,
		},
	};
})();

export const withDerivedColors = (theme: Theme) => {
	const backgroundColor5 = theme.backgroundColor5 ?? theme.color4;
	const backgroundColor4 = theme.backgroundColor4;

	// Colors need to be converted to string to work in some cases (in particular
	// on mobile)
	const rgbString = (color: typeof Color): string => color.rgb().string();
	const hexString = (color: typeof Color): string => color.hex();

	return {
		...theme,

		borderColor4: rgbString(Color(theme.color).alpha(0.3)),
		iconColor: rgbString(Color(theme.color).alpha(0.8)),
		focusOutlineColor: theme.colorWarn,
		focusOutlineColorDimmed: rgbString(Color(theme.colorWarn).alpha(0.4)),

		backgroundColor5,
		backgroundColorHover5: hexString(Color(backgroundColor5).darken(0.2)),
		backgroundColorActive5: hexString(Color(backgroundColor5).darken(0.4)),

		colorFaded2: rgbString(Color(theme.color2).alpha(0.52)),
		colorHover2: rgbString(Color(theme.color2).alpha(0.7)),
		colorActive2: rgbString(Color(theme.color2).alpha(0.9)),

		backgroundColorHoverDim3: rgbString(Color(theme.backgroundColorHover3).alpha(0.3)),
		backgroundColorActive3: rgbString(Color(theme.backgroundColorHover3).alpha(0.5)),
		backgroundColorHover2: rgbString(Color(theme.selectedColor2).alpha(0.4)),
		backgroundColorHover4: rgbString(Color(theme.backgroundColorHover3).alpha(0.3)),
		backgroundColorActive4: rgbString(Color(theme.backgroundColorHover3).alpha(0.8)),

		scrollbarThumbColor: rgbString(Color(theme.color).alpha(0.54)),
		scrollbarThumbColorHover: rgbString(Color(theme.color).alpha(0.63)),
		scrollbarThumbColor2: rgbString(Color(theme.color2).alpha(0.46)),
		scrollbarThumbColorHover2: rgbString(Color(theme.color2).alpha(0.63)),

		selectedDividerColor: hexString(Color(theme.dividerColor).darken(0.2)),
		color5: theme.color5 ?? backgroundColor4,
		colorHover3: theme.color3,
	};
};

type ThemeAndDerivedColors = ReturnType<typeof withDerivedColors>;

export function extraStyles(theme: ThemeAndDerivedColors) {
	const zoomRatio = 1;
	const mac = shim.isMac();

	const baseFontSize = mac ? macosUiFontSize : Math.round(12 * zoomRatio);
	const fontSizes = {
		fontSize: baseFontSize,
		toolbarIconSize: mac ? 16 : 18,
		noteViewerFontSize: mac ? macosBodyFontSize : Math.round(baseFontSize * 1.25),
	};

	const inputStyle = {
		...globalStyle.inputStyle,
		color: theme.color,
		backgroundColor: theme.backgroundColor,
		borderColor: theme.dividerColor,
	};

	const containerStyle = {
		...globalStyle.containerStyle,
		color: theme.color,
		backgroundColor: theme.backgroundColor,
	};

	const buttonStyle = {
		...globalStyle.buttonStyle,
		color: theme.color4,
		backgroundColor: theme.backgroundColor4,
		borderColor: theme.borderColor4,
		userSelect: literal('none'),
		// cursor: 'pointer',

	};

	const tagStyle = {
		fontSize: baseFontSize,
		fontFamily: globalStyle.fontFamily,
		paddingTop: 4,
		paddingBottom: 4,
		paddingRight: 10,
		paddingLeft: 10,
		backgroundColor: theme.backgroundColor3,
		color: theme.color3,
		display: literal('flex'),
		alignItems: literal('center'),
		justifyContent: literal('center'),
		marginRight: 8,
		borderRadius: 100,
		borderWidth: 0,
	};

	const toolbarStyle = {
		height: globalStyle.toolbarHeight,
		minWidth: globalStyle.toolbarHeight,
		display: literal('flex'),
		alignItems: literal('center'),
		paddingLeft: globalStyle.headerButtonHPadding,
		paddingRight: globalStyle.headerButtonHPadding,
		textDecoration: literal('none'),
		fontFamily: globalStyle.fontFamily,
		fontSize: baseFontSize,
		boxSizing: literal('border-box'),
		cursor: literal('default'),
		justifyContent: literal('center'),
		color: theme.color,
		whiteSpace: literal('nowrap'),
	};

	const textStyle = {
		fontFamily: globalStyle.fontFamily,
		fontSize: baseFontSize,
		lineHeight: mac ? '1.4' : '1.6em',
		color: theme.color,
	};

	const textStyle2 = {
		...textStyle,
		color: theme.color2,
	};

	const textStyleMinor = { ...textStyle,
		color: theme.colorFaded,
		fontSize: mac ? macosSecondaryFontSize : baseFontSize * 0.8,
	};

	const urlStyle = {
		...textStyle,
		textDecoration: literal('underline'),
		color: theme.urlColor,
	};

	const h1Style = {
		...textStyle,
		color: theme.color,
		fontSize: mac ? 17 : textStyle.fontSize * 1.5,
		fontWeight: mac ? literal('600') : literal('bold'),
		...(mac ? { letterSpacing: '-0.022em' } : {}),
	};

	const h2Style = {
		...textStyle,
		color: theme.color,
		fontSize: mac ? 15 : textStyle.fontSize * 1.3,
		fontWeight: mac ? literal('600') : literal('bold'),
		...(mac ? { letterSpacing: '-0.016em' } : {}),
	};

	return {
		zoomRatio,
		...fontSizes,

		icon: {
			...globalStyle.icon,
			color: theme.color,
		},
		lineInput: {
			...globalStyle.lineInput,
			color: theme.color,
			backgroundColor: theme.backgroundColor,
		},

		containerStyle,
		configScreenPadding: globalStyle.mainPadding * 2,
		noteListHeaderHeight: mac ? 28 : 26,
		noteListHeaderBorderPadding: 4,

		textStyle,
		textStyle2,
		textStyleMinor,
		clickableTextStyle: { ...textStyle, userSelect: literal('none') },
		headerStyle: {
			...globalStyle.headerStyle,
			color: theme.color,
			backgroundColor: theme.backgroundColor,
		},
		h1Style,
		h2Style,
		urlStyle,
		inputStyle,

		toolbarStyle,
		tagStyle,
		buttonStyle,

		dialogModalLayer: {
			zIndex: 9999,
			display: literal('flex'),
			position: literal('absolute'),
			top: 0,
			left: 0,
			width: '100%',
			height: '100%',
			backgroundColor: 'rgba(0,0,0,0.6)',
			alignItems: literal('flex-start'),
			justifyContent: literal('center'),
		},

		controlBox: {
			marginBottom: '1em',
			color: 'black', // This will apply for the calendar
			display: literal('flex'),
			flexDirection: literal('row'),
			alignItems: literal('center'),
		},
		controlBoxLabel: {
			marginRight: '1em',
			width: '10em',
			display: literal('inline-block'),
			fontWeight: literal('bold'),
		},
		controlBoxValue: {
			display: literal('inline-block'),
		},

		dialogBox: {
			backgroundColor: theme.backgroundColor,
			padding: mac ? 20 : 16,
			boxShadow: mac ? '0 18px 50px rgba(0,0,0,0.22)' : '6px 6px 20px rgba(0,0,0,0.5)',
			marginTop: 20,
			maxHeight: '80%',
			display: literal('flex'),
			flexDirection: literal('column'),
			...(mac ? { borderRadius: 12 } : {}),
		},
		buttonIconStyle: {
			color: theme.iconColor,
			marginRight: 6,
		},
		notificationBox: {
			backgroundColor: theme.warningBackgroundColor,
			display: literal('flex'),
			alignItems: literal('center'),
			padding: 10,
			fontSize: baseFontSize,
		},
		dialogTitle: { ...h1Style, marginBottom: '1.2em', marginTop: '0' },
		dropdownList: { ...inputStyle },
		colorHover: theme.color,
		backgroundHover: `${theme.selectedColor2}44`,
		// In general the highlighted color, used to highlight text or icons, should be the same as selectedColor2
		// but some times, depending on the theme, it might be too dark or too light, so it can be
		// specified directly by the theme too.
		highlightedColor: theme.highlightedColor ?? theme.selectedColor2,
		markHighlightColor: theme.searchMarkerColor,
		markHighlightBackgroundColor: theme.searchMarkerBackgroundColor,
		selectedTextColor: theme.color,
	};
}

type ExtraStyles = ReturnType<typeof extraStyles>;
type GlobalStyle = typeof globalStyle;
export type ThemeStyle = ThemeAndDerivedColors & ExtraStyles & GlobalStyle & { cacheKey: number };

const themeCache_: Record<string, ThemeStyle> = {};

export function themeStyle(themeId: number): ThemeStyle {
	if (!themeId) throw new Error('Theme must be specified');

	const cacheKey = themeId;
	if (themeCache_[cacheKey]) return themeCache_[cacheKey];

	const theme = withDerivedColors(applyMacosTheme(themeId, themes[themeId]));
	const output: ThemeStyle = {
		cacheKey,
		...globalStyle,
		...theme,

		// All theme are based on the light style, and just override the
		// relevant properties
		...extraStyles(theme),
	};

	if (shim.isMac()) {
		const dark = output.appearance === ThemeAppearance.Dark;
		const accent = dark ? '#0a84ff' : '#007aff';
		const usesSystemChrome = themeId === Setting.THEME_LIGHT || themeId === Setting.THEME_DARK;
		output.focusOutlineColor = accent;
		output.focusOutlineColorDimmed = dark ? 'rgba(10,132,255,0.45)' : 'rgba(0,122,255,0.35)';
		output.scrollbarThumbColor = dark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.32)';
		output.scrollbarThumbColorHover = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.48)';
		output.scrollbarThumbColor2 = output.scrollbarThumbColor;
		output.scrollbarThumbColorHover2 = output.scrollbarThumbColorHover;
		if (usesSystemChrome) {
			output.backgroundColorHover2 = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
			output.selectedTextColor = '#ffffff';
		}
	}

	themeCache_[cacheKey] = output;
	return themeCache_[cacheKey];
}

const cachedStyles_: {
	themeId: number | null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cached styles are heterogeneous per call site; see buildStyle below
	styles: Record<string, { style: any; timestamp: number }>;
} = {
	themeId: null,
	styles: {},
};

// cacheKey must be a globally unique key, and must change whenever
// the dependencies of the style change. If the style depends only
// on the theme, a static string can be provided as a cache key.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Style shape varies per call site (CSSProperties for React, styled-components objects, plain CSS strings)
type BuildStyleCallback = (style: ThemeStyle)=> any;
export function buildStyle(cacheKey: string | (string | number)[], themeId: number, callback: BuildStyleCallback) {
	cacheKey = Array.isArray(cacheKey) ? cacheKey.join('_') : cacheKey;

	// We clear the cache whenever switching themes
	if (cachedStyles_.themeId !== themeId) {
		cachedStyles_.themeId = themeId;
		cachedStyles_.styles = {};
	}

	if (cachedStyles_.styles[cacheKey]) return cachedStyles_.styles[cacheKey].style;

	const s = callback(themeStyle(themeId));

	cachedStyles_.styles[cacheKey] = {
		style: s,
		timestamp: Date.now(),
	};

	return cachedStyles_.styles[cacheKey].style;
}
