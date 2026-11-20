import * as React from 'react';
import { _, _n } from '@joplin/lib/locale';
import { AiChatMessage } from '../../app.reducer';
import InlineMarkdownDisplay from '../InlineMarkdownDisplay';
import { ChatMessage, ChatRole, ChatStandardMessage, ChatToolMessage } from '@joplin/lib/services/ai/types';

const toolCalls = (messages: ChatMessage[]) => messages
	.filter((message): message is ChatStandardMessage => message.role === ChatRole.Assistant)
	.flatMap(message => message.toolCalls ?? []);

const toolResults = (messages: ChatMessage[]) => messages.filter((message): message is ChatToolMessage => message.role === ChatRole.Tool);

const toolLabel = (toolName: string) => {
	switch (toolName) {
	case 'editor_readNoteBody': return _('Read note');
	case 'editor_replaceRange': return _('Replace note text');
	case 'editor_insertBefore': return _('Insert before text');
	case 'editor_insertAfter': return _('Insert after text');
	case 'editor_appendToNote': return _('Append to note');
	case 'editor_replaceFencedBlock': return _('Update structured block');
	case 'editor_replaceSelection': return _('Replace selected text');
	default: return toolName;
	}
};

const toolFailureDescription = (result: ChatToolMessage) => {
	const error = typeof result.content === 'string' ? result.content : '';
	if (error.includes('anchor-not-found')) return _('Could not match the note text; this edit was not applied.');
	if (error.includes('invalid')) return _('This edit could not be applied.');
	if (error.includes('tool call limit reached')) return _('Skipped to prevent too many actions.');
	return result.userDescription || _('This action failed.');
};

const toolActivity = (messages: ChatMessage[], noteId: string|null, sending: boolean, undoingToolCallId: string|null, onUndo: (result: ChatToolMessage)=> void) => {
	const calls = toolCalls(messages);
	if (!calls.length) return null;

	const results = toolResults(messages);
	const completedCount = calls.filter(call => results.some(result => result.toolCallId === call.callId)).length;
	const failedCount = calls.filter(call => results.some(result => result.toolCallId === call.callId && result.isError)).length;
	const hasPending = completedCount < calls.length;
	const hasUndo = results.some(result => result.editUndo && result.editUndo.noteId === noteId);
	const summary = hasPending
		? _('Working: %d of %d actions complete.', completedCount, calls.length)
		: failedCount
			? _('%d of %d actions failed.', failedCount, calls.length)
			: _n('%d action complete', '%d actions complete', calls.length, calls.length);

	return <details className='tool-activity' open={hasPending || hasUndo || failedCount > 0}>
		<summary>
			<i className={`status-icon fas ${hasPending ? 'fa-spinner fa-spin' : failedCount ? 'fa-exclamation-triangle' : 'fa-check'}`} aria-hidden='true'/>
			<span>{summary}</span>
			<i className='disclosure-icon fas fa-chevron-down' aria-hidden='true'/>
		</summary>
		<ol className='action-list'>
			{calls.map(call => {
				const result = results.find(item => item.toolCallId === call.callId);
				const state = !result ? 'pending' : result.isError ? 'failed' : 'complete';
				const description = result
					? result.isError ? toolFailureDescription(result) : result.userDescription
					: '';
				const canUndo = !sending && !!result?.editUndo && result.editUndo.noteId === noteId;

				return <li key={call.callId} className={`action -${state}`}>
					<i
						className={`status-icon fas ${state === 'pending' ? 'fa-spinner fa-spin' : state === 'failed' ? 'fa-exclamation-triangle' : 'fa-check'}`}
						aria-hidden='true'
					/>
					<div className='action-copy'>
						<span className='action-title'>{toolLabel(call.toolName)}</span>
						{description && <span className='action-description'>{description}</span>}
					</div>
					{canUndo && <button
						className='undo-action'
						type='button'
						disabled={sending || undoingToolCallId === result.toolCallId}
						onClick={() => onUndo(result)}
					>{undoingToolCallId === result.toolCallId ? _('Undoing…') : _('Undo')}</button>}
				</li>;
			})}
		</ol>
	</details>;
};

interface Props {
	message: AiChatMessage;
	noteId: string|null;
	sending: boolean;
	undoingToolCallId: string|null;
	onUndo: (result: ChatToolMessage)=> void;
}

const ChatMessageItem: React.FC<Props> = ({ message, noteId, sending, undoingToolCallId, onUndo }) => {
	if (message.role === 'separator') {
		return <div className='separator'>{message.text}</div>;
	}
	if (message.role === 'error') {
		return <div className='error'>{message.text}</div>;
	}

	const activity = message.role === 'assistant'
		? toolActivity(message.raw, noteId, sending, undoingToolCallId, onUndo)
		: null;
	const textContent = message.text || (!activity ? _('(no message)') : '');
	const content = !textContent
		? null
		: message.role === 'assistant'
			? <InlineMarkdownDisplay className='content' markdown={textContent} allowLinks={false}/>
			: <div className='content'>{textContent}</div>;

	return (
		<div className={`chat-message turn -${message.role}`}>
			{content}
			{activity}
		</div>
	);
};

export default ChatMessageItem;
