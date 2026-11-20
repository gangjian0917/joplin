import * as React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { AiChatMessage } from '../../app.reducer';
import { ChatRole, ChatToolCall, ChatToolMessage } from '@joplin/lib/services/ai/types';
import ChatMessageItem from './ChatMessageItem';

describe('ChatMessageItem', () => {
	it('should offer a guarded undo action for applied AI edits', () => {
		const toolCall: ChatToolCall = { toolName: 'editor_appendToNote', callId: 'call-1', arguments: {}, parseError: null };
		const toolResult: ChatToolMessage = {
			role: ChatRole.Tool,
			toolName: 'editor_appendToNote',
			toolCallId: 'call-1',
			content: 'Added text',
			userDescription: 'Added 1 word',
			isError: false,
			isEdit: true,
			editUndo: { noteId: 'note-a', before: 'Before', after: 'After' },
		};
		const message: AiChatMessage = {
			id: 'edit',
			createdTime: 1,
			noteId: 'note-a',
			noteTitle: 'A',
			role: 'assistant',
			text: '',
			raw: [
				{ role: ChatRole.Assistant, content: '', toolCalls: [toolCall] },
				toolResult,
			],
		};
		const onUndo = jest.fn();
		const view = render(<ChatMessageItem message={message} noteId='note-a' sending={false} undoingToolCallId={null} onUndo={onUndo}/>);

		fireEvent.click(view.getByRole('button', { name: 'Undo' }));

		expect(onUndo).toHaveBeenCalledWith(toolResult);
	});

	it('should expand failed note actions and explain that the edit was not applied', () => {
		const toolCall: ChatToolCall = { toolName: 'editor_replaceRange', callId: 'call-1', arguments: {}, parseError: null };
		const toolResult: ChatToolMessage = {
			role: ChatRole.Tool,
			toolName: 'editor_replaceRange',
			toolCallId: 'call-1',
			content: 'failed: anchor-not-found',
			userDescription: 'anchor-not-found',
			isError: true,
			isEdit: true,
		};
		const message: AiChatMessage = {
			id: 'failed-edit',
			createdTime: 1,
			noteId: 'note-a',
			noteTitle: 'A',
			role: 'assistant',
			text: '',
			raw: [
				{ role: ChatRole.Assistant, content: '', toolCalls: [toolCall] },
				toolResult,
			],
		};

		const view = render(<ChatMessageItem message={message} noteId='note-a' sending={false} undoingToolCallId={null} onUndo={jest.fn()}/>);

		expect(view.getByText('Could not match the note text; this edit was not applied.')).toBeTruthy();
	});
});
