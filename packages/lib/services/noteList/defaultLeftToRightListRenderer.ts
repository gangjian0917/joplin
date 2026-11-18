import { _ } from '../../locale';
import { MarkupLanguage, MarkupToHtml } from '@joplin/renderer';
import { ItemFlow, ListRenderer } from '../plugins/api/noteListType';
import isNoteLockEnabled from '../noteLock/isNoteLockEnabled';

interface Props {
	note: {
		id: string;
		title: string;
		is_published: boolean;
		is_todo: number;
		todo_completed: number;
		body: string;
		is_locked: number;
	};
	item: {
		size: {
			width: number;
			height: number;
		};
		selected: boolean;
	};
}

const defaultLeftToRightItemRenderer: ListRenderer = {
	id: 'detailed',

	label: async () => _('Detailed'),

	flow: ItemFlow.LeftToRight,

	itemSize: {
		width: 150,
		height: 150,
	},

	dependencies: [
		'item.selected',
		'item.size.width',
		'item.size.height',
		'note.body',
		'note.id',
		'note.is_locked',
		'note.is_published',
		'note.is_shared',
		'note.is_todo',
		'note.isWatched',
		'note.title',
		'note.todo_completed',
	],

	itemCss: // css
		`
		& {
			box-sizing: border-box;
			padding: 1.5px 6px;
		}

		> .content.-selected {
			background-color: var(--joplin-note-list-selected-background-color, var(--joplin-selected-color));
		}

		&:hover > .content:not(.-selected) {
			background-color: var(--joplin-background-color-hover3);
		}
	
		> .content {
			display: flex;
			box-sizing: border-box;
			position: relative;
			width: 100%;
			height: 100%;
			border-radius: 8px;
			padding: 12px 12px;
			align-items: flex-start;
			overflow-y: hidden;
			flex-direction: column;
			user-select: none;
			transition: background-color 0.12s ease;
	
			> .checkbox {
				display: flex;
				align-items: center;

				> input {
					margin: 0px 10px 1px 0px;
					accent-color: var(--joplin-selected-color2);
				}
			}
	
			> .title {
				font-family: var(--joplin-font-family);
				font-size: var(--joplin-font-size);
				font-weight: 600;
				letter-spacing: -0.006em;
				color: var(--joplin-color);
				cursor: default;
				flex: 0;
				display: flex;
				align-items: flex-start;
				margin-bottom: 8px;

				> .checkbox {
					margin: 0 6px 0 0;
				}

				> .watchedicon {
					display: none;
					padding-right: 4px;
					color: var(--joplin-color);
				}

				> .lockedicon {
					padding-right: 4px;
					color: var(--joplin-color);
				}

				> .titlecontent {
					word-break: break-all;
					overflow: hidden;
					text-overflow: ellipsis;
					text-wrap: nowrap;
				}
			}

			> .preview {
				overflow-y: hidden;
				font-family: var(--joplin-font-family);
				font-size: 11px;
				line-height: 1.35;
				letter-spacing: 0;
				color: var(--joplin-color-faded);
				cursor: default;
			}
		}

		> .content.-shared {
			> .title {
				color: var(--joplin-color-warn3);
			}
		}

		> .content.-published {
			> .title {
				color: var(--joplin-color4);
			}
		}

		> .content.-selected > .title,
		> .content.-selected > .preview,
		> .content.-published.-selected > .title,
		> .content.-shared.-selected > .title,
		> .content.-selected > .title > .watchedicon,
		> .content.-selected > .title > .lockedicon {
			color: var(--joplin-note-list-selected-text-color, var(--joplin-selected-text-color, var(--joplin-color)));
		}

		> .content.-completed {
			> .title {
				opacity: 0.5;
			}
		}

		> .content.-watched {
			> .title {
				> .watchedicon {
					display: inline;
				}
			}
		}
	`,

	itemTemplate: // html
		`
		<div class="content {{#item.selected}}-selected{{/item.selected}} {{#note.is_shared}}-shared{{/note.is_shared}} {{#note.is_published}}-published{{/note.is_published}} {{#note.todo_completed}}-completed{{/note.todo_completed}} {{#note.isWatched}}-watched{{/note.isWatched}}">
			<div style="width: {{titleWidth}}px;" class="title" data-id="{{note.id}}">
				{{#note.is_todo}}
					<input class="checkbox" data-id="todo-checkbox" type="checkbox" {{#note.todo_completed}}checked="checked"{{/note.todo_completed}}>
				{{/note.is_todo}}
				<i class="watchedicon fa fa-share-square"></i>
				{{#note.is_locked}}<i class="lockedicon fa fa-lock"></i>{{/note.is_locked}}
				<div class="titlecontent">{{note.title}}</div>
			</div>
			<div class="preview">{{notePreview}}</div>
		</div>
	`,

	onRenderNote: async (props: Props) => {
		const markupToHtml_ = new MarkupToHtml();
		const isLocked = isNoteLockEnabled() ? props.note.is_locked : 0;

		return {
			...props,
			note: { ...props.note, is_locked: isLocked },
			// A locked note's body is ciphertext, so there is no meaningful preview to show.
			notePreview: isLocked ? '' : markupToHtml_.stripMarkup(MarkupLanguage.Markdown, props.note.body).substring(0, 200),
			titleWidth: props.item.size.width - 32,
		};
	},
};

export default defaultLeftToRightItemRenderer;
