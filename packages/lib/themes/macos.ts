import Setting from '../models/Setting';
import shim from '../shim';
import { Theme, ThemeAppearance } from './type';

// `-apple-system` uses the native system font, with macOS choosing the right
// fallback for other scripts.
export const macosFontFamily = '-apple-system, BlinkMacSystemFont, sans-serif';
export const macosMonospaceFontFamily = 'ui-monospace, "SF Mono", Menlo, Monaco, monospace';

// macOS UI, body, and footnote text styles.
export const macosUiFontSize = 13;
export const macosBodyFontSize = 16;
export const macosSecondaryFontSize = 11;
export const macosNoteTitleFontSize = 17;

const light: Partial<Theme> = {
	appearance: ThemeAppearance.Light,
	backgroundColor: '#ffffff',
	backgroundColorTransparent: 'rgba(255,255,255,0.94)',
	oddBackgroundColor: '#f5f5f7',
	color: '#1d1d1f',
	colorError: '#ff3b30',
	colorCorrect: '#34c759',
	colorWarn: '#ff9500',
	colorWarnUrl: '#007aff',
	colorFaded: '#86868b',
	dividerColor: 'rgba(0,0,0,0.09)',
	selectedColor: '#e5e5ea',
	urlColor: '#007aff',
	colorErrorSelected: '#ffffff',
	shadowColor: 'rgba(0,0,0,0.12)',
	backgroundColor2: '#fafafa',
	color2: '#1d1d1f',
	selectedColor2: '#007aff',
	sidebarSelectedBackgroundColor: '#e6f1eb',
	sidebarSelectedTextColor: '#1d1d1f',
	colorError2: '#ff3b30',
	colorPublished2: '#007aff',
	colorWarn2: '#ff9500',
	colorWarn3: '#ff9500',
	backgroundColorTransparent2: 'rgba(0,0,0,0.05)',
	backgroundColor3: '#fafafa',
	backgroundColorHover3: '#f2f2f2',
	noteListSelectedBackgroundColor: '#e6f1eb',
	noteListSelectedTextColor: '#1d1d1f',
	color3: '#3a3a3c',
	backgroundColor4: '#ffffff',
	color4: '#007aff',
	backgroundColor4Dimmed: '#e5f1ff',
	raisedBackgroundColor: '#e5e5ea',
	raisedColor: '#1d1d1f',
	searchMarkerBackgroundColor: '#ffe14a',
	searchMarkerColor: '#000000',
	warningBackgroundColor: '#fff4e0',
	destructiveColor: '#ff3b30',
	tableBackgroundColor: '#f8f8fa',
	codeBackgroundColor: '#f3f4f6',
	codeBorderColor: 'rgba(0,0,0,0.08)',
	codeColor: '#1d1d1f',
	headerBackgroundColor: '#fafafa',
	textSelectionColor: '#b3d7ff',
	colorBright2: '#ffffff',
	highlightedColor: '#007aff',
};

const dark: Partial<Theme> = {
	appearance: ThemeAppearance.Dark,
	backgroundColor: '#1e1e20',
	backgroundColorTransparent: 'rgba(30,30,32,0.94)',
	oddBackgroundColor: '#2c2c2e',
	color: '#f5f5f7',
	colorError: '#ff453a',
	colorCorrect: '#32d74b',
	colorWarn: '#ff9f0a',
	colorWarnUrl: '#0a84ff',
	colorFaded: '#8e8e93',
	dividerColor: 'rgba(255,255,255,0.09)',
	selectedColor: '#3a3a3c',
	urlColor: '#0a84ff',
	colorErrorSelected: '#ffffff',
	shadowColor: 'rgba(0,0,0,0.45)',
	backgroundColor2: '#262629',
	color2: '#f5f5f7',
	selectedColor2: '#0a84ff',
	sidebarSelectedBackgroundColor: '#243a2e',
	sidebarSelectedTextColor: '#ffffff',
	colorError2: '#ff453a',
	colorPublished2: '#64d2ff',
	colorWarn2: '#ff9f0a',
	colorWarn3: '#ff9f0a',
	backgroundColorTransparent2: 'rgba(255,255,255,0.07)',
	backgroundColor3: '#212124',
	backgroundColorHover3: 'rgba(255,255,255,0.06)',
	noteListSelectedBackgroundColor: '#243a2e',
	noteListSelectedTextColor: '#ffffff',
	color3: '#e5e5ea',
	backgroundColor4: '#2c2c2e',
	color4: '#0a84ff',
	backgroundColor4Dimmed: '#1c3d66',
	raisedBackgroundColor: '#3a3a3c',
	raisedColor: '#ffffff',
	searchMarkerBackgroundColor: '#ffe14a',
	searchMarkerColor: '#000000',
	warningBackgroundColor: '#3a2a12',
	destructiveColor: '#ff453a',
	tableBackgroundColor: '#27272a',
	codeBackgroundColor: '#2a2a2e',
	codeBorderColor: 'rgba(255,255,255,0.1)',
	codeColor: '#f5f5f7',
	codeMirrorTheme: 'material-darker',
	codeThemeCss: 'atom-one-dark-reasonable.css',
	headerBackgroundColor: '#262629',
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
