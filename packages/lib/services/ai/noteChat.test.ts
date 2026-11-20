import { _internal, ChatCommands, compactChatHistory, estimateHistoryTokens, runNoteChat } from './noteChat';
import AiService from './AiService';
import { ChatRole, ChatToolCall } from './types';
import { expectThrow, setupDatabase, switchClient, withWarningSilenced } from '../../testing/test-utils';
import Setting from '../../models/Setting';
import { NoteContext } from './tools/types';
import ToolIndex from './tools/ToolIndex';
import { isEditorToolCall } from './tools/buildEditorTools';

const makeTestContext = (defaultContext: Partial<NoteContext>) => {
	const initialContext: NoteContext = {
		title: 'Test',
		body: 'Body',
		noteId: '00000000000000000000000000000000',
		folderId: '00000000000000000000000000000001',
		selection: null,
		...defaultContext,
	};
	let body = initialContext.body;

	const commands: ChatCommands = {
		replaceSelection: jest.fn(),
		updateNoteBody: (newBody) => {
			body = newBody;
			return Promise.resolve();
		},
		displayError: jest.fn(),
	};

	const context = () => ({ ...initialContext, body });

	return {
		onContext: () => Promise.resolve(context()),
		get context() { return context(); },
		commands,
	};
};

describe('noteChat', () => {
	beforeAll(async () => {
		await setupDatabase(0);
		await switchClient(0);
		Setting.setValue('ai.chat.providerType', 'test-provider');
		Setting.setValue('ai.enabled', true);
	});

	test('systemPrompt includes selection when present and omits full body', () => {
		const prompt = _internal.systemPrompt({
			title: 'My note',
			body: 'long body text',
			selection: 'just this bit',
			noteId: '',
			folderId: '',
		});
		expect(prompt).toContain('My note');
		expect(prompt).toContain('just this bit');
		expect(prompt).toContain('BEGIN SELECTION');
		expect(prompt).not.toContain('long body text');
	});

	test('systemPrompt advertises Joplin-specific Markdown features', () => {
		const prompt = _internal.systemPrompt({ title: 'n', body: 'b', noteId: '', folderId: '', selection: null });
		// The fence tags are the load-bearing strings — the model knows the
		// syntax inside (JSONCanvas, Mermaid, KaTeX) but needs the Joplin
		// fence tag to wrap it correctly.
		expect(prompt).toContain('jsoncanvas');
		expect(prompt).toContain('mermaid');
		expect(prompt).toContain('KaTeX');
		// Don't-invent-IDs guidance for note + resource links.
		expect(prompt).toContain('Never invent NOTE_IDs');
		expect(prompt).toContain('Never invent RESOURCE_IDs');
		// Checkboxes (todos).
		expect(prompt).toContain('- [ ]');
	});

	test('systemPrompt should not include body', () => {
		const prompt = _internal.systemPrompt({
			title: 'My note',
			body: 'the whole body',
			noteId: '',
			folderId: '',
			selection: null,
		});
		// Including the body in the prompt would cause a cache invalidation on each note change
		expect(prompt).not.toContain('the whole body');
	});

	test.each([
		{
			label: 'restricts ops to replaceSelection when selection present',
			note: {
				title: 'My note',
				body: 'long body text',
				selection: 'just this bit',
			},
			expectedOperations: ['replaceSelection'],
		},
		{
			label: 'offers anchor operations when no selection present',
			note: {
				title: 'n',
				body: 'b',
				selection: null,
			},
			expectedOperations: ['insertBefore', 'insertAfter', 'appendToNote', 'replaceRange', 'readNoteBody'],
		},
		{
			label: 'offers replaceFencedBlock when Mermaid block present',
			note: {
				title: 'n',
				body: '```mermaid\ngitGraph\n\tcommit\n```\n',
				selection: null,
			},
			expectedOperations: ['insertBefore', 'insertAfter', 'appendToNote', 'replaceRange', 'replaceFencedBlock', 'readNoteBody'],
		},
	])('toolDefinitions should include the expected operations (case $label)', ({ note, expectedOperations }) => {
		const { commands, context } = makeTestContext(note);
		const editSchemaItems = new ToolIndex({ note: context, commands }).getTools();

		const allowedSchemaOperations = editSchemaItems.map(item => item.id).sort();
		expect(
			allowedSchemaOperations.filter(id => isEditorToolCall(id)),
		).toEqual([...expectedOperations].map(o => `editor_${o}`).sort());
	});

	test('estimateTokens approximates char/4', () => {
		expect(_internal.estimateTokens('')).toBe(0);
		expect(_internal.estimateTokens('a'.repeat(400))).toBe(100);
	});

	test('estimateHistoryTokens counts tool results once', () => {
		expect(estimateHistoryTokens([{
			role: ChatRole.Tool,
			content: '12345678',
			toolName: 'editor_readNoteBody',
			toolCallId: 'call-1',
			isError: false,
			userDescription: 'Read note',
			isEdit: false,
		}])).toBe(2);
	});

	test('compactChatHistory summarizes history into reusable context turns', async () => {
		const chat = jest.spyOn(AiService.instance(), 'chat').mockResolvedValue({
			text: 'The user asked to update the note.',
			toolCalls: [],
			usage: { inputTokens: 10, outputTokens: 5 },
		});
		const signal = new AbortController().signal;
		try {
			await expect(compactChatHistory([
				{ role: ChatRole.User, content: 'Update the note.' },
			], signal)).resolves.toEqual([
				{ role: ChatRole.User, content: 'Earlier conversation summary (context only):\nThe user asked to update the note.' },
				{ role: ChatRole.Assistant, content: 'I will use this summary as prior conversation context.' },
			]);
			expect(chat).toHaveBeenCalledWith([
				{ role: ChatRole.System, content: expect.stringContaining('Summarize this portion') },
				{ role: ChatRole.User, content: 'user: Update the note.' },
			], { maxTokens: 1500, signal });
		} finally {
			chat.mockRestore();
		}
	});

	test('toolDefinitions advertises replaceFencedBlock with structured-block guidance', () => {
		const { context, commands } = makeTestContext({ title: 'n', body: '```abc\n```', selection: null });
		const tools = new ToolIndex({ note: context, commands }).getTools();
		const toolDefinition = tools.find(tool => tool.id === 'editor_replaceFencedBlock');
		expect(toolDefinition).toBeTruthy();
		expect(toolDefinition.description).toContain('jsoncanvas');
		// Guidance to use the op for structured blocks, appendToNote for creation.
		expect(toolDefinition.description).toContain('"text" is the new content inside the fence (no fence markers)');
		expect(toolDefinition.description).toContain('Use appendToNote');
	});

	test('assertWithinTokenBudget should include tool calls in the token budget', async () => {
		_internal.assertWithinTokenBudget([
			{ role: ChatRole.Assistant, content: 'Testing... '.repeat(5) },
		], 100);

		await expectThrow(async () => {
			_internal.assertWithinTokenBudget([
				{
					role: ChatRole.Assistant,
					content: 'Testing...'.repeat(5),
					toolCalls: [{
						toolName: 'editor_replaceSelection',
						callId: 'call-1',
						arguments: { text: 'Testing... '.repeat(50) },
						parseError: null,
					}],
				},
			], 100);
		}, 'aiNoteTooLarge');
	});

	test('runTools should describe successful edit operations', async () => {
		const toolCalls: ChatToolCall[] = [
			{ toolName: 'editor_appendToNote', callId: 'call-1', arguments: { text: 'Test.' }, parseError: null },
			{ toolName: 'editor_replaceRange', callId: 'call-2', arguments: { anchor: 'Body', text: 'Updated' }, parseError: null },
		];

		const { onContext, commands } = makeTestContext({});

		const result = await _internal.runTools(
			{ text: 'Test...', toolCalls, usage: { inputTokens: 10, outputTokens: 300 } },
			await onContext(),
			onContext,
			commands,
			new AbortController().signal,
			new Map(),
		);

		expect((await onContext()).body).toBe('Updated\n\nTest.');
		expect(result.responses).toMatchObject([
			{
				role: ChatRole.Tool,
				toolName: 'editor_appendToNote',
				toolCallId: 'call-1',
				isError: false,
				userDescription: 'Added 1 word',
			},
			{
				role: ChatRole.Tool,
				toolName: 'editor_replaceRange',
				toolCallId: 'call-2',
				isError: false,
				userDescription: 'Removed 1 word\nAdded 1 word',
			},
		]);
		expect(result.responses[1].editUndo).toEqual({
			noteId: '00000000000000000000000000000000',
			before: 'Body',
			after: 'Updated\n\nTest.',
		});
	});

	test('noteChat should stop retry loop if several responses in a row include tool failures', async () => {
		const { onContext, commands } = makeTestContext({});
		const failingAndSucceedingToolCall = (repeat: number) => [
			`/repeat ${repeat}`,
			// one failing tool
			`/tool editor_replaceRange ${JSON.stringify({ anchor: 'does not exist', text: 'replaced' })}`,
			// and one tool call that should succeed
			'/tool editor_appendToNote { "text": "test" }',
		].join('\n');

		const userMessage = failingAndSucceedingToolCall(32);
		const result = await withWarningSilenced(
			/call editor_replaceRange failed/,
			() => runNoteChat(
				onContext,
				[],
				userMessage,
				commands,
				() => {},
				new AbortController().signal,
			),
		);

		const failedAttempts = [];
		for (let i = 0; i < 5; i++) {
			failedAttempts.push(
				{ role: ChatRole.Assistant },
				{ role: ChatRole.Tool, isError: true, toolName: 'editor_replaceRange' },
				{ role: ChatRole.Tool, isError: false, toolName: 'editor_appendToNote' },
			);
		}

		expect(result).toMatchObject([
			{ role: ChatRole.System },
			{ role: ChatRole.User, content: userMessage },

			// Reading the body
			{ role: ChatRole.Assistant },
			{ role: ChatRole.Tool },

			...failedAttempts,

			{ role: ChatRole.Assistant, content: 'tool not found: editor_replaceRange\ntool not found: editor_appendToNote' },
		]);
	});

	test('noteChat should pause after more than 12 edits to the same line', async () => {
		const { onContext, commands } = makeTestContext({});
		const result = await runNoteChat(
			onContext,
			[],
			'/repeat 100\n/tool editor_replaceRange { "anchor": "B", "text": "Bx" }',
			commands,
			() => {},
			new AbortController().signal,
		);

		const toolResults = result.filter(message => message.role === ChatRole.Tool && message.toolName === 'editor_replaceRange');
		expect(toolResults.filter(message => message.role === ChatRole.Tool && !message.isError)).toHaveLength(12);
		expect(result[result.length - 1]).toMatchObject({
			role: ChatRole.Assistant,
			content: expect.stringContaining('Paused after more than 12 edits to the same line'),
		});
		expect((await onContext()).body).toBe(`B${'x'.repeat(12)}ody`);
	});

	test('noteChat should allow more than 12 edits when they target different lines', async () => {
		const { onContext, commands } = makeTestContext({});
		const result = await runNoteChat(
			onContext,
			[],
			'/repeat 20\n/tool editor_appendToNote { "text": "x\\n" }',
			commands,
			() => {},
			new AbortController().signal,
		);

		const successfulEdits = result.filter(message => message.role === ChatRole.Tool
			&& message.toolName === 'editor_appendToNote'
			&& !message.isError);
		expect(successfulEdits).toHaveLength(20);
		expect(result.some(message => message.role === ChatRole.Assistant && message.content.includes('Paused after more than'))).toBe(false);
	});

	test('noteChat initialize the chat history with the note body', async () => {
		const { onContext, commands } = makeTestContext({});

		const result = await runNoteChat(
			onContext,
			[],
			'test',
			commands,
			() => {},
			new AbortController().signal,
		);

		expect(result).toMatchObject([
			{ role: ChatRole.System },
			{ role: ChatRole.User, content: 'test' },
			{ role: ChatRole.Assistant, content: '', toolCalls: [{ toolName: 'editor_readNoteBody' }] },
			{ role: ChatRole.Tool, content: 'Body', toolName: 'editor_readNoteBody' },
			{ role: ChatRole.Assistant, content: '' },
		]);
	});
});
