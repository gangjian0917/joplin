import Setting from '../models/Setting';
import shim from '../shim';
import { Theme, ThemeAppearance } from './type';

// macOS 15 system text. `-apple-system` is SF Pro, and uses PingFang SC for
// Chinese. PingFang must not come first: it contains Latin glyphs and would
// replace SF Pro.
export const macosFontFamily = '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", sans-serif';
export const macosMonospaceFontFamily = 'ui-monospace, "SF Mono", Menlo, Monaco, monospace';

// NSFont.systemFontSize is 13pt. Note body follows Apple Notes at 16pt.
export const macosUiFontSize = 13;
export const macosBodyFontSize = 16;
export const macosSecondaryFontSize = 11;
export const macosNoteTitleFontSize = 22;

const light: Partial<Theme> = {
	appearance: ThemeAppearance.Light,
	backgroundColor: '#ffffff',
	backgroundColorTransparent: 'rgba(255,255,255,0.94)',
	oddBackgroundColor: '#f5f5f7',
	color: '#000000',
	colorError: '#ff3b30',
	colorCorrect: '#34c759',
	colorWarn: '#ff9500',
	colorWarnUrl: '#007aff',
	colorFaded: '#8e8e93',
	dividerColor: '#d1d1d6',
	selectedColor: '#007aff',
	urlColor: '#007aff',
	colorErrorSelected: '#ffffff',
	shadowColor: 'rgba(0,0,0,0.12)',
	backgroundColor2: '#ececec',
	color2: '#000000',
	selectedColor2: '#007aff',
	colorError2: '#ff3b30',
	colorPublished2: '#007aff',
	colorWarn2: '#ff9500',
	colorWarn3: '#ff9500',
	backgroundColorTransparent2: 'rgba(0,0,0,0.06)',
	backgroundColor3: '#f5f5f7',
	backgroundColorHover3: '#e8e8ed',
	color3: '#3c3c43',
	backgroundColor4: '#ffffff',
	color4: '#007aff',
	backgroundColor4Dimmed: '#e5f1ff',
	raisedBackgroundColor: '#e5e5ea',
	raisedColor: '#000000',
	searchMarkerBackgroundColor: '#ffe14a',
	searchMarkerColor: '#000000',
	warningBackgroundColor: '#fff4e0',
	destructiveColor: '#ff3b30',
	tableBackgroundColor: '#f5f5f7',
	codeBackgroundColor: '#f2f2f7',
	codeBorderColor: '#e5e5ea',
	codeColor: '#000000',
	headerBackgroundColor: '#ececec',
	textSelectionColor: '#b3d7ff',
	colorBright2: '#ffffff',
	highlightedColor: '#007aff',
};

const dark: Partial<Theme> = {
	appearance: ThemeAppearance.Dark,
	backgroundColor: '#1c1c1e',
	backgroundColorTransparent: 'rgba(28,28,30,0.94)',
	oddBackgroundColor: '#2c2c2e',
	color: '#ffffff',
	colorError: '#ff453a',
	colorCorrect: '#32d74b',
	colorWarn: '#ff9f0a',
	colorWarnUrl: '#0a84ff',
	colorFaded: '#98989d',
	dividerColor: '#3a3a3c',
	selectedColor: '#0a84ff',
	urlColor: '#0a84ff',
	colorErrorSelected: '#ffffff',
	shadowColor: 'rgba(0,0,0,0.45)',
	backgroundColor2: '#2c2c2e',
	color2: '#ffffff',
	selectedColor2: '#0a84ff',
	colorError2: '#ff453a',
	colorPublished2: '#64d2ff',
	colorWarn2: '#ff9f0a',
	colorWarn3: '#ff9f0a',
	backgroundColorTransparent2: 'rgba(255,255,255,0.08)',
	backgroundColor3: '#1c1c1e',
	backgroundColorHover3: '#3a3a3c',
	color3: '#ebebf5',
	backgroundColor4: '#2c2c2e',
	color4: '#0a84ff',
	backgroundColor4Dimmed: '#1c3d66',
	raisedBackgroundColor: '#3a3a3c',
	raisedColor: '#ffffff',
	searchMarkerBackgroundColor: '#ffe14a',
	searchMarkerColor: '#000000',
	warningBackgroundColor: '#3a2a12',
	destructiveColor: '#ff453a',
	tableBackgroundColor: '#2c2c2e',
	codeBackgroundColor: '#2c2c2e',
	codeBorderColor: '#3a3a3c',
	codeColor: '#ffffff',
	codeMirrorTheme: 'material-darker',
	codeThemeCss: 'atom-one-dark-reasonable.css',
	headerBackgroundColor: '#2c2c2e',
	textSelectionColor: '#3a5f8a',
	colorBright2: '#ffffff',
	highlightedColor: '#0a84ff',
};

export function applyMacosTheme(themeId: number, theme: Theme): Theme {
	if (!shim.isMac()) return theme;
	if (themeId === Setting.THEME_LIGHT) return { ...theme, ...light };
	if (themeId === Setting.THEME_DARK) return { ...theme, ...dark };
	return theme;
}

// Joplin's desktop default is 15px. On macOS that value is treated as the
// system body size so an existing profile matches Notes without a settings change.
export function macosEditorFontSize(configured: number): number {
	if (!shim.isMac()) return configured;
	if (configured === 15) return macosBodyFontSize;
	return configured;
}
