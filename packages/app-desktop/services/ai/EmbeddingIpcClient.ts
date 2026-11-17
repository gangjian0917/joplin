import { ipcRenderer } from 'electron';
import { EmbeddingCompute } from '@joplin/lib/services/ai/types';
import { EmbeddingRequest, EmbeddingResponse, EMBEDDING_REQUEST_CHANNEL, EMBEDDING_RESPONSE_CHANNEL, PendingEntry, isErrorResponse } from './embeddingWorkerProtocol';

// Renderer-side EmbeddingCompute: forwards batches to the embedding utility
// process via the main process. No timeouts anywhere — a single batch can
// legitimately run for tens of seconds on a fat note.

export default class EmbeddingIpcClient implements EmbeddingCompute {

	private nextRequestId_ = 1;
	private pending_ = new Map<number, PendingEntry>();
	private initPayload_: { modelDir: string; archiveName: string } | null = null;

	public constructor() {
		ipcRenderer.on(EMBEDDING_RESPONSE_CHANNEL, (_event, response: EmbeddingResponse) => {
			const pending = this.pending_.get(response.requestId);
			if (!pending) return;
			this.pending_.delete(response.requestId);

			if (isErrorResponse(response)) {
				const error = new Error(response.error.message);
				if (response.error.stack) error.stack = response.error.stack;
				pending.reject(error);
			} else {
				pending.resolve(response.result);
			}
		});
	}

	private send(action: EmbeddingRequest['action'], payload: EmbeddingRequest['payload']): Promise<null | number[][]> {
		const request: EmbeddingRequest = {
			requestId: this.nextRequestId_++,
			action,
			payload,
		};
		return new Promise((resolve, reject) => {
			this.pending_.set(request.requestId, { resolve, reject });
			ipcRenderer.send(EMBEDDING_REQUEST_CHANNEL, request);
		});
	}

	public async init(payload: { modelDir: string; archiveName: string }): Promise<void> {
		this.initPayload_ = payload;
		await this.send('init', payload);
	}

	public async embed(texts: string[], prefix: string): Promise<number[][]> {
		try {
			const result = await this.send('embed', { texts, prefix });
			// null would mean a protocol violation (embed replies with vectors);
			// let it fail loudly in the consumer instead of masquerading as [].
			if (result === null) throw new Error('Embedding worker returned no vectors');
			return result;
		} catch (error) {
			// The worker restarts empty after a crash (its init state is lost)
			// while the provider thinks it's already initialised. Re-init once
			// and retry; without this every embed would fail until app restart.
			if (this.initPayload_ && /not initialised/.test(String((error as Error).message))) {
				await this.send('init', this.initPayload_);
				const retried = await this.send('embed', { texts, prefix });
				if (retried === null) throw new Error('Embedding worker returned no vectors');
				return retried;
			}
			throw error;
		}
	}
}
