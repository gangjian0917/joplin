import * as React from 'react';
import { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { connect } from 'react-redux';
import { Dispatch } from 'redux';
import { _ } from '@joplin/lib/locale';
import Setting from '@joplin/lib/models/Setting';
import Note from '@joplin/lib/models/Note';
import CommandService from '@joplin/lib/services/CommandService';
import Logger from '@joplin/utils/Logger';
import { stateUtils } from '@joplin/lib/reducer';
import { AiChatMessage, AppState } from '../../app.reducer';
import { compactChatHistory, estimateHistoryTokens, noteChatAutoCompactThreshold, runNoteChat } from '@joplin/lib/services/ai/noteChat';
import { AvailabilityReason, chatAvailability } from '@joplin/lib/services/ai/availability';
import { WindowIdContext } from '../NewWindowOrIFrame';
import AiDegradedNotice from '../AiDegradedNotice';
import { ChatMessage, ChatRole, ChatToolMessage } from '@joplin/lib/services/ai/types';
import JoplinError from '@joplin/lib/JoplinError';
import eventManager, { EventName, ItemChangeEvent } from '@joplin/lib/eventManager';
import { Second } from '@joplin/utils/time';
import ChatMessageItem from './ChatMessageItem';
import NavService from '@joplin/lib/services/NavService';
import ChatConversation from '@joplin/lib/models/ChatConversation';
import uuid from '@joplin/lib/uuid';
import { focus } from '@joplin/lib/utils/focusHandler';
import dialogs from '../dialogs';
import ChatHistory, { Conversation } from './ChatHistory';
import Button, { ButtonLevel } from '../Button/Button';

const logger = Logger.create('ChatPanel');

interface Props {
	themeId: number;
	available: boolean;
	availabilityReason?: AvailabilityReason;
	unavailableHint: string;
	providerType: string;
	noteId: string | null;
	noteTitle: string;
	noteIsEncrypted: boolean;
	messages: AiChatMessage[];
	conversationId?: string|null;
	aiDegraded: boolean;
	showToolbarButton: boolean;
	dispatch: Dispatch;
}

const disclosureSetting = 'ai.chat.disclosureAcknowledged';

const makeId = () => uuid.create();

const waitForNextNoteChangeOrTimeout = (noteId: string, timeout: number) => {
	return new Promise<void>((resolve) => {
		const listener = (event: ItemChangeEvent) => {
			if (event.itemId === noteId) {
				onComplete();
			}
		};
		const onComplete = () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
			eventManager.off(EventName.ItemChange, listener);
			resolve();
		};
		eventManager.on(EventName.ItemChange, listener);

		let timeoutId = setTimeout(() => {
			onComplete();
		}, timeout);
	});
};

const useCancelCallback = () => {
	const abortControllerRef = useRef(new AbortController());

	const cancelRequest = useCallback(() => {
		abortControllerRef.current.abort();
		abortControllerRef.current = new AbortController();
	}, []);

	// Cancel on Reset / unmount so an in-flight reply can detect it should
	// abort instead of landing in a cleared or destroyed conversation.
	const cancelRequestRef = useRef(cancelRequest);
	cancelRequestRef.current = cancelRequest;
	useEffect(() => () => {
		cancelRequestRef.current();
	}, []);

	return { abortControllerRef, cancelRequest };
};

const useHasFocus = () => {
	const [hasFocus, setHasFocus] = useState(false);
	const onFocus = useCallback(() => setHasFocus(true), []);
	const onBlur: React.FocusEventHandler<HTMLDivElement> = useCallback((event) => {
		const chatPanelContainer = event.currentTarget;
		const newElementWithFocus = event.relatedTarget;
		const movingFocusOut = !chatPanelContainer.contains(newElementWithFocus);

		// Avoid quickly toggling hasFocus: onBlur/onFocus are emitted when moving focus between
		// elements within the container.
		if (movingFocusOut) {
			setHasFocus(false);
		}
	}, []);

	return { hasFocus, onFocus, onBlur };
};

// Single-window for v1: mapStateToProps hard-codes defaultWindowId and the
// toggle writes to the app-wide layout. A second window would mirror the main.
const ChatPanel: React.FC<Props> = (props) => {
	const { dispatch, messages } = props;
	const [input, setInput] = useState('');
	const [historyOpen, setHistoryOpen] = useState(false);
	const historyId = useId();
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [requestStatus, setRequestStatus] = useState('');
	const [undoingToolCallId, setUndoingToolCallId] = useState<string|null>(null);
	const composerInputRef = useRef<HTMLTextAreaElement>(null);
	const loadConversationHistory = useCallback(async (search = '') => {
		try {
			setConversations(await ChatConversation.history(search));
		} catch (error) {
			logger.error('Could not load chat conversations', error);
		}
	}, []);
	const handleHistoryToggle = useCallback(async () => {
		setHistoryOpen(!historyOpen);
		if (historyOpen) return;
		await loadConversationHistory();
	}, [historyOpen, loadConversationHistory]);
	const historyPopupRef = useRef<HTMLDivElement>(null);
	const historyButtonRef = useRef<HTMLButtonElement>(null);
	const closeHistory = useCallback(() => {
		setHistoryOpen(false);
		focus('ChatPanel::closeHistory', historyButtonRef.current);
	}, []);
	useEffect(() => {
		if (!historyOpen) return () => {};
		const onMouseDown = (event: MouseEvent) => {
			const target = event.target as Node;
			if (historyPopupRef.current?.contains(target) || historyButtonRef.current?.contains(target)) return;
			setHistoryOpen(false);
		};
		const doc = historyButtonRef.current.ownerDocument;
		doc.addEventListener('mousedown', onMouseDown);
		return () => doc.removeEventListener('mousedown', onMouseDown);
	}, [historyOpen]);
	const [sending, setSending] = useState(false);
	const archivingRef = useRef(false);
	const [disclosureShown, setDisclosureShown] = useState<boolean>(() => {
		try {
			return !!Setting.value(disclosureSetting);
		} catch {
			return false;
		}
	});

	const lastNoteIdRef = useRef<string | null>(props.noteId);
	const messagesLengthRef = useRef(messages.length);
	messagesLengthRef.current = messages.length;
	// Lets async work detect note switches without re-running its closure.
	const noteIdRef = useRef(props.noteId);
	noteIdRef.current = props.noteId;
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const { hasFocus, onFocus, onBlur } = useHasFocus();

	const { abortControllerRef, cancelRequest } = useCancelCallback();

	const windowId = useContext(WindowIdContext);

	const appendMessage = useCallback(async (message: Omit<AiChatMessage, 'noteId' | 'noteTitle' | 'createdTime'>) => {
		const fullMessage: AiChatMessage = { ...message, createdTime: Date.now(), noteId: props.noteId ?? '', noteTitle: props.noteId ? props.noteTitle : '' };
		try {
			await ChatConversation.addMessage(props.conversationId, fullMessage);
		} catch (error) {
			logger.error('Could not save chat message:', error);
		}
	}, [props.noteId, props.noteTitle, props.conversationId]);

	const removeMessage = useCallback(async (id: string) => {
		try {
			await ChatConversation.removeMessage(props.conversationId, id);
		} catch (error) {
			logger.error('Could not remove chat message:', error);
		}
	}, [props.conversationId]);

	const addToolResult = useCallback(async (result: ChatToolMessage) => {
		try {
			await ChatConversation.addToolResult(props.conversationId, result);
		} catch (error) {
			logger.error('Could not save chat tool result:', error);
		}
	}, [props.conversationId]);

	const handleUndoEdit = useCallback(async (result: ChatToolMessage) => {
		const undo = result.editUndo;
		if (sending || !undo || undo.noteId !== props.noteId || !props.conversationId) return;
		setUndoingToolCallId(result.toolCallId);
		try {
			const note = await Note.load(undo.noteId);
			if (!note || note.body !== undo.after || noteIdRef.current !== undo.noteId) {
				throw new JoplinError(
					_('The note changed after this AI edit. Undo was not applied to protect newer changes.'),
					'aiChatUndoConflict',
				);
			}

			const changeListener = waitForNextNoteChangeOrTimeout(undo.noteId, Second);
			await CommandService.instance().executeInWindow('editor.setText', {
				windowId,
				args: [undo.before],
			});
			await changeListener;

			const updatedNote = await Note.load(undo.noteId);
			if (!updatedNote || updatedNote.body !== undo.before) {
				throw new JoplinError(_('Could not undo the AI edit.'), 'aiChatUndoFailed');
			}
			await ChatConversation.markToolUndoApplied(props.conversationId, result.toolCallId);
		} catch (error) {
			logger.warn('Could not undo AI edit:', error);
			void appendMessage({ id: makeId(), role: 'error', text: error.message || _('Could not undo the AI edit.'), raw: [] });
		} finally {
			setUndoingToolCallId(null);
		}
	}, [appendMessage, props.conversationId, props.noteId, sending, windowId]);

	useEffect(() => {
		if (props.conversationId) return;
		dispatch({ type: 'AI_CHAT_OPEN', windowId, conversationId: uuid.create(), messages });
	}, [props.conversationId, dispatch, windowId, messages]);

	// Drop a separator when the active note changes mid-conversation. Skip
	// the first ever opened note (no prior context to separate from).
	useEffect(() => {
		const prev = lastNoteIdRef.current;
		lastNoteIdRef.current = props.noteId;
		if (prev === null || prev === props.noteId || !props.noteId) return;
		if (messagesLengthRef.current === 0) return;

		const text = _('— now viewing: %s —', props.noteTitle || _('(untitled)'));
		void appendMessage({
			id: makeId(),
			role: 'separator',
			text,
			raw: [{ role: ChatRole.User, content: _('Switched notes: %s', text) }],
		});
	}, [props.noteId, props.noteTitle, appendMessage]);

	useEffect(() => {
		if (messages.length === 0) return;
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages, requestStatus]);

	const conversationTurns = useMemo<ChatMessage[]>(() => {
		return messages
			.map(m => m.raw)
			.flat();
	}, [messages]);
	const contextTokenEstimate = useMemo(() => estimateHistoryTokens(conversationTurns), [conversationTurns]);

	// Joplin Cloud is remote but the user already consented via sync setup.
	const requiresDisclosure = props.providerType !== 'joplin-cloud';
	const showDisclosure = requiresDisclosure && !disclosureShown && messages.length === 0;

	const handleCancel = useCallback(() => {
		cancelRequest();
		setRequestStatus('');
		void appendMessage({ id: makeId(), role: 'assistant', text: _('(Cancelled)'), raw: [] });
	}, [cancelRequest, appendMessage]);

	const handleNewChat = useCallback(() => {
		if (archivingRef.current) return;
		cancelRequest();
		setRequestStatus('');
		// Only saved once a message is sent so empty chats don't show up in history
		dispatch({ type: 'AI_CHAT_OPEN', windowId, conversationId: uuid.create(), messages: [] });
	}, [dispatch, windowId, cancelRequest]);

	const compactConversation = useCallback(async (history: ChatMessage[], preserveMessageId?: string) => {
		if (!props.conversationId) throw new Error('Cannot compact a chat without a conversation ID.');
		const compactedHistory = await compactChatHistory(history, abortControllerRef.current.signal);
		const now = Date.now();
		await ChatConversation.compact(props.conversationId, {
			id: makeId(),
			createdTime: now,
			role: 'assistant',
			text: '',
			raw: compactedHistory,
			hide: true,
			noteId: props.noteId ?? '',
			noteTitle: '',
		}, preserveMessageId);
		return compactedHistory;
	}, [abortControllerRef, props.conversationId, props.noteId]);

	const handleSend = useCallback(async (prompt?: string) => {
		const text = (prompt ?? input).trim();
		if (!text || sending) return;
		const abortController = abortControllerRef.current;
		if (text === '/clear') {
			setInput('');
			handleNewChat();
			return;
		}
		if (text === '/compact') {
			setInput('');
			setSending(true);
			setRequestStatus(_('Compacting conversation…'));
			try {
				if (!conversationTurns.length) {
					void appendMessage({ id: makeId(), role: 'error', text: _('There is no conversation context to compact.'), raw: [] });
					return;
				}
				await compactConversation(conversationTurns);
				void appendMessage({ id: makeId(), role: 'assistant', text: _('Conversation context compacted.'), raw: [] });
			} catch (error) {
				if (abortController.signal.aborted) return;
				logger.warn('Could not compact chat context:', error);
				void appendMessage({ id: makeId(), role: 'error', text: error.message || _('Could not compact conversation context.'), raw: [] });
			} finally {
				setSending(false);
				setRequestStatus('');
			}
			return;
		}
		if (!props.noteId) {
			void appendMessage({
				id: makeId(), role: 'error', text: _('Open a note to start chatting.'), raw: [],
			});
			return;
		}
		const noteIdAtStart = props.noteId;
		setSending(true);
		setRequestStatus(_('Thinking…'));
		setInput('');

		// Captured so we can roll it back on failure — otherwise a retry would
		// send the prior user turn as history alongside the new prompt.
		const userTurnId = makeId();
		let hadVisibleResponse = false;
		void appendMessage({
			id: userTurnId,
			role: 'user',
			text,
			raw: [{ role: ChatRole.User, content: text }],
		});

		try {
			const note = await Note.load(props.noteId);
			if (abortController.signal.aborted) return;
			if (!note) throw new Error(`Note not found: ${props.noteId}`);

			const getContext = async () => {
				let selection = '';
				try {
					selection = await CommandService.instance().executeInWindow(
						'selectedText', { windowId, args: [] },
					) as string || '';
				} catch {
					// Editor may not be ready; treat as no selection.
				}

				const note = await Note.load(props.noteId);
				if (!note) throw new Error(`Note not found: ${props.noteId}`);

				return {
					body: note.body,
					title: note.title,
					selection,
					noteId: note.id,
					folderId: note.parent_id,
				};
			};

			let requestTurns = conversationTurns;
			if (estimateHistoryTokens([
				...requestTurns,
				{ role: ChatRole.User, content: text },
			]) > noteChatAutoCompactThreshold && requestTurns.length) {
				requestTurns = await compactConversation(requestTurns, userTurnId);
			}

			let lastHistory = [
				{ role: ChatRole.System, content: 'placeholder' },
				...requestTurns,
			];
			const pendingToolCallIds = new Set<string>();

			const onHistoryChanged = (history: ChatMessage[]) => {
				if (abortController.signal.aborted) return;

				for (let i = lastHistory.length; i < history.length; i++) {
					const entry = history[i];

					if (entry.role === ChatRole.Assistant) {
						pendingToolCallIds.clear();
						for (const call of entry.toolCalls ?? []) pendingToolCallIds.add(call.callId);
						setRequestStatus(pendingToolCallIds.size ? _('Working with the note…') : _('Thinking…'));
					} else if (entry.role === ChatRole.Tool) {
						pendingToolCallIds.delete(entry.toolCallId);
						setRequestStatus(pendingToolCallIds.size ? _('Working with the note…') : _('Thinking…'));
					}

					// User messages are added elsewhere, when the user submits the chat
					if (entry.role === ChatRole.User) continue;
					// System messages are not shown in the UI
					if (entry.role === ChatRole.System) continue;

					if (entry.role === ChatRole.Tool) {
						void addToolResult(entry);
					} else {
						hadVisibleResponse ||= !entry.hide;
						const messageId = makeId();

						void appendMessage({
							id: messageId,
							role: entry.role,
							text: entry.content,
							hide: entry.hide,
							raw: [entry],
						});
					}
				}

				lastHistory = history;
			};

			const assertSameNote = () => {
				if (noteIdAtStart !== noteIdRef.current) {
					cancelRequest();
					throw new JoplinError(
						_('You switched notes while the request was running; edits were not applied. Try again.'), 'aiNoteChanged',
					);
				}
			};

			await runNoteChat(
				getContext, requestTurns, text, {
					replaceSelection: async (text, oldText) => {
						if (text === oldText) return;
						assertSameNote();

						const changeListener = waitForNextNoteChangeOrTimeout(props.noteId, Second);
						await CommandService.instance().executeInWindow('replaceSelection', {
							windowId,
							args: [text],
						});
						await changeListener;
					},
					updateNoteBody: async (newBody, oldBody) => {
						if (newBody === oldBody) return;
						assertSameNote();

						const changeListener = waitForNextNoteChangeOrTimeout(props.noteId, Second);
						await CommandService.instance().executeInWindow('editor.setText', {
							windowId,
							args: [newBody],
						});
						await changeListener;
					},
					displayError: (message) => {
						void appendMessage({ id: makeId(), role: 'error', text: message, raw: [] });
					},
				}, onHistoryChanged, abortController.signal,
			);
		} catch (error) {
			logger.warn('Chat failed:', error);
			if (abortController.signal.aborted) return;

			if (!hadVisibleResponse) {
				void removeMessage(userTurnId);
				setInput(text);
			}
			void appendMessage({ id: makeId(), role: 'error', text: error.message || _('Something went wrong.'), raw: [] });
		} finally {
			setSending(false);
			setRequestStatus('');
		}
	}, [input, sending, props.noteId, conversationTurns, windowId, addToolResult, appendMessage, removeMessage, cancelRequest, abortControllerRef, handleNewChat, compactConversation]);

	const handleAcknowledgeDisclosure = useCallback(() => {
		Setting.setValue(disclosureSetting, true);
		setDisclosureShown(true);
	}, []);

	const handleOpenConversation = useCallback(async (conversationId: string) => {
		if (conversationId === props.conversationId || archivingRef.current) return;
		archivingRef.current = true;
		cancelRequest();
		try {
			await CommandService.instance().executeInWindow('openAiChatConversation', { windowId, args: [conversationId] });
		} catch (error) {
			logger.error('Could not open chat conversation:', error);
		} finally {
			archivingRef.current = false;
		}
	}, [windowId, cancelRequest, props.conversationId]);

	const handleClose = useCallback(() => {
		void CommandService.instance().executeInWindow('toggleAiChat', { windowId: windowId, args: [] });
	}, [windowId]);

	const handleDeleteConversation = useCallback(async (conversationId: string) => {
		if (archivingRef.current) return;
		archivingRef.current = true;
		if (conversationId === props.conversationId) cancelRequest();
		try {
			await ChatConversation.deleteConversation(conversationId);
			setConversations(current => current.filter(item => item.id !== conversationId));
			dispatch({ type: 'AI_CHAT_DELETE', conversationId });
		} catch (error) {
			logger.error('Could not delete chat conversation:', error);
			await dialogs.alert(_('Could not delete conversation.'));
		} finally {
			archivingRef.current = false;
		}
	}, [dispatch, cancelRequest, props.conversationId]);

	const handleRenameConversation = useCallback(async (conversation: Conversation, newTitle: string) => {
		const title = newTitle.trim();
		if (!title || title === conversation.title) return;
		try {
			await ChatConversation.renameConversation(conversation.id, title);
			setConversations(current => current.map(item => item.id === conversation.id ? { ...item, title } : item));
		} catch (error) {
			logger.error('Could not rename chat conversation:', error);
			await dialogs.alert(_('Could not rename conversation.'));
		}
	}, []);

	const handleHideToolbarButton = useCallback(() => {
		Setting.setValue('ai.chat.showToolbarButton', false);
		handleClose();
	}, [handleClose]);

	const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		// Don't send while an IME composition is in flight — Enter commits
		// the composition for CJK / accented input.
		if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
			e.preventDefault();
			if (!sending) void handleSend();
		}
	}, [handleSend, sending]);

	const renderContent = () => {
		if (!props.available) {
			const content = (
				<div className='disabled-message'>
					<div className='hint'>{props.unavailableHint}</div>
					{props.showToolbarButton && <>
						<div className='hint'>{_('If you do not want to use the AI features, you may hide the toolbar button:')}</div>
						<Button
							level={ButtonLevel.Secondary}
							title={_('Hide the AI Chat button')}
							onClick={handleHideToolbarButton}
						/>
						<div className='hint'>{_('(You can show it again from Settings → AI)')}</div>
					</>}
				</div>
			);
			return { content, showingMessages: false };
		}
		if (props.noteIsEncrypted) {
			const content = (
				<div className='disabled-message'>
					{_('This note is encrypted and cannot be used with AI Chat.')}
				</div>
			);
			return { content, showingMessages: false };
		}

		const visibleMessages = messages.filter(m => !m.hide);
		const lastVisibleMessage = visibleMessages[visibleMessages.length - 1];
		const showQuickPrompts = !!props.noteId && (!lastVisibleMessage || lastVisibleMessage.role === 'separator');

		const content = <>
			{props.aiDegraded && <AiDegradedNotice className='degraded-status' />}
			<div className='messages' aria-live={hasFocus ? 'polite' : undefined}>
				{visibleMessages.length === 0 && (
					<div className='empty'>
						{_('Ask about this note, or request changes. Select text in the editor first to scope the request to that selection.')}
						<br/>
						<br/>
						<button
							type='button'
							className='link-button'
							onClick={() => NavService.go('Config', { props: { defaultSection: 'ai.tools' } })}
						>{_('Manage capabilities')}</button>
					</div>
				)}
				{visibleMessages.map(m => <ChatMessageItem
					key={m.id}
					message={m}
					noteId={props.noteId}
					sending={sending}
					undoingToolCallId={undoingToolCallId}
					onUndo={handleUndoEdit}
				/>)}
				{showQuickPrompts && <div className='quick-prompts' role='group' aria-label={_('Quick prompts')}>
					<span className='label'>{_('Try a common task')}</span>
					<div className='actions'>
						{[
							{
								label: _('Polish note'),
								prompt: _('Improve this note\'s writing and readability. Preserve its meaning and facts, and apply the edits directly to the note.'),
							},
							{
								label: _('Format note'),
								prompt: _('Improve the formatting of this note using clear headings, lists, and Markdown where appropriate. Preserve its meaning and content, and apply the edits directly to the note.'),
							},
							{
								label: _('Condense note'),
								prompt: _('Condense this note by removing repetition and unnecessary wording while preserving all important information. Apply the edits directly to the note.'),
							},
							{
								label: _('Add a summary'),
								prompt: _('Add a concise summary at the beginning of this note. Keep the original content intact.'),
							},
						].map(({ label, prompt }) => <button
							key={label}
							type='button'
							disabled={sending}
							onClick={() => { void handleSend(prompt); }}
						>{label}</button>)}
					</div>
				</div>}
				{sending && <div className='request-status' role='status'>
					<i className='fas fa-spinner fa-spin' aria-hidden='true'/>
					<span>{requestStatus || _('Thinking…')}</span>
				</div>}
				<div ref={messagesEndRef} />
			</div>
			<div className='composer'>
				{showDisclosure && (
					<div className='disclosure'>
						{_('Your note will be sent to the configured AI provider (%s).', props.providerType)}
						{' '}
						<a href='#' onClick={(e) => { e.preventDefault(); handleAcknowledgeDisclosure(); }}>{_('Don\'t show again')}</a>
					</div>
				)}
				<div className='composer-toolbar'>
					<span className='shortcut'>{_('Enter to send · Shift+Enter for a new line')}</span>
					<div className='quick-commands'>
						<button type='button' disabled={sending} onClick={() => { setInput('/compact'); focus('ChatPanel::command', composerInputRef.current); }}>/compact</button>
						<button type='button' disabled={sending} onClick={() => { setInput('/clear'); focus('ChatPanel::command', composerInputRef.current); }}>/clear</button>
					</div>
				</div>
				<div className='input-wrapper'>
					<textarea
						className='input'
						ref={composerInputRef}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder={_('Ask about this note, request a change, or use /clear or /compact…')}
						aria-label={_('Chat message')}
					/>
					<button
						type='button'
						className='send'
						onClick={() => { if (sending) handleCancel(); else void handleSend(); }}
						disabled={!sending && !input.trim()}
						aria-label={sendButtonLabel}
						title={sendButtonLabel}
					>
						<i className={sending ? 'fas fa-stop' : 'fas fa-paper-plane'} aria-hidden='true' />
					</button>
				</div>
			</div>
		</>;

		return { content, showingMessages: visibleMessages.length > 0 };
	};

	const sendButtonLabel = sending ? _('Stop generating') : _('Send');
	const closeLabel = _('Close');
	const newChatLabel = _('New chat');
	const headerId = useId();
	const { content, showingMessages } = renderContent();

	return (
		<div
			className='chat-panel'
			role='region'
			aria-labelledby={headerId}
			onFocus={onFocus}
			onBlur={onBlur}
		>
			<div className='header chat-panel-header'>
				<h1 className='title' id={headerId}>{_('AI Chat')}</h1>
				{props.availabilityReason !== AvailabilityReason.Disabled && (
					<button
						type='button'
						className='history toolbar-button'
						ref={historyButtonRef}
						onClick={handleHistoryToggle}
						title={_('Chat history')}
						aria-label={_('Chat history')}
						aria-expanded={historyOpen}
						aria-controls={historyId}
					>
						<i className='toolbar-icon far fa-clock' aria-hidden='true'/>
					</button>
				)}
				{historyOpen && (
					// Placed right after its button so that Tab moves from the button into the popup
					<ChatHistory
						conversations={conversations}
						currentConversationId={props.conversationId}
						id={historyId}
						popupRef={historyPopupRef}
						onSearchChange={loadConversationHistory}
						onOpen={handleOpenConversation}
						onRename={handleRenameConversation}
						onDelete={handleDeleteConversation}
						onClose={closeHistory}
					/>
				)}
				<button type='button' className='reset toolbar-button' onClick={handleNewChat} disabled={!showingMessages} title={newChatLabel} aria-label={newChatLabel}>
					<i className='toolbar-icon fas fa-comment-medical' aria-hidden='true'/>
				</button>
				<button
					type='button'
					className='close toolbar-button'
					onClick={handleClose}
					title={closeLabel}
					aria-label={closeLabel}
				><i className='toolbar-icon fas fa-times' role='img' aria-hidden={true}/></button>
			</div>
			{props.noteId && <div className='context-strip' title={props.noteTitle || _('Untitled note')}>
				<i className='fas fa-file-alt' aria-hidden='true'/>
				<span>{props.noteTitle || _('Untitled note')}</span>
				{conversationTurns.length > 0 && <div className={`context-usage${contextTokenEstimate >= noteChatAutoCompactThreshold * 0.8 ? ' -near-limit' : ''}`}>
					<span>{_('%s tokens', new Intl.NumberFormat().format(contextTokenEstimate))}</span>
					<progress
						max={noteChatAutoCompactThreshold}
						value={Math.min(contextTokenEstimate, noteChatAutoCompactThreshold)}
						aria-label={_('Conversation history size')}
					/>
				</div>}
			</div>}
			{content}
		</div>
	);
};

interface OwnProps {
	windowId: string;
}

const mapStateToProps = (state: AppState, ownProps: OwnProps) => {
	const windowState = stateUtils.windowStateById(state, ownProps.windowId);
	const noteId = stateUtils.selectedNoteId(windowState);
	const note = noteId ? windowState.notes.find(n => n.id === noteId) : null;
	const availability = chatAvailability();
	return {
		themeId: state.settings.theme,
		available: availability.available,
		availabilityReason: availability.reason,
		unavailableHint: availability.hint ?? '',
		providerType: state.settings['ai.chat.providerType'] || 'openai-compatible',
		noteId,
		noteTitle: note?.title || '',
		noteIsEncrypted: !!note?.encryption_applied,
		messages: windowState.aiChatMessages || [],
		conversationId: windowState.aiChatConversationId,
		aiDegraded: !!state.aiStatus?.degraded,
		showToolbarButton: !!state.settings['ai.chat.showToolbarButton'],
	};
};

const ConversationPanel: React.FC<Props> = props => <ChatPanel key={props.conversationId} {...props} />;

export default connect(mapStateToProps)(ConversationPanel);
