// Message types for the renderer → main process → embedding utility process
// chain. Kept free of electron imports so both ends can use it.

export interface EmbeddingInitPayload {
	modelDir: string;
	archiveName: string;
}

export interface EmbeddingRequest {
	requestId: number;
	action: 'init' | 'embed';
	payload: EmbeddingInitPayload | { texts: string[]; prefix: string };
}

export type EmbeddingResponse =
	| { requestId: number; ok: true; result: null | number[][] }
	| { requestId: number; ok: false; error: { message: string; stack?: string } };

// Discriminated-union narrowing: TS won't narrow `ok: boolean` via a simple
// truthiness check across IPC boundaries, so expose it as an explicit guard.
export const isErrorResponse = (response: EmbeddingResponse): response is Extract<EmbeddingResponse, { ok: false }> => {
	return response.ok === false;
};

export const EMBEDDING_REQUEST_CHANNEL = 'embeddingRequest';
export const EMBEDDING_RESPONSE_CHANNEL = 'embeddingResponse';

export const serializeError = (error: unknown): { message: string; stack?: string } => {
	if (error instanceof Error) {
		return { message: error.message, stack: error.stack };
	}
	return { message: String(error) };
};

export interface PendingEntry {
	resolve: (result: null | number[][])=> void;
	reject: (error: Error)=> void;
}
