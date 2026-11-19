import { _ } from '@joplin/lib/locale';

interface ButtonDefinition {
	name: string;
	tooltip: string;
	icon: string;
	format?: string;
}

function buttonDefinitions(): ButtonDefinition[] {
	return [
		{
			name: 'joplinHighlight',
			tooltip: _('Highlight'),
			icon: 'highlight-bg-color',
		},
		{
			name: 'joplinStrikethrough',
			tooltip: _('Strikethrough'),
			icon: 'strike-through',
		},
		{
			name: 'joplinInsert',
			tooltip: _('Insert'),
			icon: 'underline',
		},
		{
			name: 'joplinSup',
			tooltip: _('Superscript'),
			icon: 'superscript',
		},
		{
			name: 'joplinSub',
			tooltip: _('Subscript'),
			icon: 'subscript',
		},
		{
			name: 'joplinH1',
			tooltip: _('Heading 1'),
			icon: 'h1',
			format: 'h1',
		},
		{
			name: 'joplinH2',
			tooltip: _('Heading 2'),
			icon: 'h2',
			format: 'h2',
		},
		{
			name: 'joplinH3',
			tooltip: _('Heading 3'),
			icon: 'h3',
			format: 'h3',
		},
	];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TinyMCE editor is dynamically loaded; published types don't cover the editor.ui.registry / formatter shape we use
export default function(editor: any) {
	const definitions = buttonDefinitions();

	for (const def of definitions) {
		const format = def.format || def.name;
		editor.ui.registry.addToggleButton(def.name, {
			tooltip: def.tooltip,
			icon: def.icon,
			onAction: async function() {
				editor.execCommand('mceToggleFormat', false, format);
			},
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TinyMCE ToggleButton onSetup api type not in published types
			onSetup: function(api: any) {
				editor.formatter.formatChanged(format, (state: boolean) => {
					api.setActive(state);
				});
			},
		});
	}
}
