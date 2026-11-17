// Embedding utility process: runs the ONNX inference that would otherwise
// block the renderer's main thread for seconds per batch. Bundled separately
// by tools/bundleJs.ts and unpacked outside app.asar so its external requires
// (onnxruntime-node) resolve against the unpacked node_modules mirror.

// eslint-disable-next-line @typescript-eslint/no-var-requires -- external at bundle time; must resolve at worker startup
const ort = require('onnxruntime-node');
// eslint-disable-next-line @typescript-eslint/no-var-requires -- inlined at bundle time (sharp is stubbed out)
const transformers = require('@huggingface/transformers');

import LocalEmbeddingInference, { Tokenizer, TransformersModule, loadTokenizerFromModule } from '@joplin/lib/services/ai/LocalEmbeddingInference';
import { EmbeddingInitPayload, EmbeddingRequest, EmbeddingResponse, serializeError } from './embeddingWorkerProtocol';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the utility-process port type isn't exported for tsc
const port: { on(event: string, listener: (e: { data: unknown })=> void): void; postMessage(message: unknown): void } = (process as any).parentPort;

let inference: LocalEmbeddingInference | null = null;
let initialisedFor: EmbeddingInitPayload | null = null;

const post = (response: EmbeddingResponse) => {
	port.postMessage(response);
};

const handleInit = async (payload: EmbeddingInitPayload): Promise<null> => {
	// Idempotent for repeat inits with the same model (the provider re-runs
	// ensureInitialised after a cancelled request); rebuilds on model change.
	if (initialisedFor && initialisedFor.modelDir === payload.modelDir && initialisedFor.archiveName === payload.archiveName) {
		return null;
	}

	const tokenizer: Tokenizer = await loadTokenizerFromModule(transformers as TransformersModule, payload.modelDir, payload.archiveName);
	const newInference = new LocalEmbeddingInference(ort, tokenizer);
	await newInference.createSession(payload.modelDir);
	inference = newInference;
	initialisedFor = payload;
	return null;
};

const handleEmbed = async (payload: { texts: string[]; prefix: string }): Promise<number[][]> => {
	if (!inference || !initialisedFor) {
		throw new Error('Embedding worker is not initialised');
	}
	// e5's asymmetric prefixes ("passage: " / "query: ") are decided by the
	// caller — the worker only concatenates.
	return inference.embed(payload.texts.map(t => `${payload.prefix}${t}`));
};

const handle = async (request: EmbeddingRequest) => {
	try {
		const result = request.action === 'init'
			? await handleInit(request.payload as EmbeddingInitPayload)
			: await handleEmbed(request.payload as { texts: string[]; prefix: string });
		post({ requestId: request.requestId, ok: true, result });
	} catch (error) {
		post({ requestId: request.requestId, ok: false, error: serializeError(error) });
	}
};

// Serialise: concurrent indexer batches + search queries hitting the same
// ONNX session would stack peak memory past what MAX_EMBED_BATCH caps (#15761).
let queue: Promise<unknown> = Promise.resolve();

port.on('message', (event: { data: unknown }) => {
	const request = event.data as EmbeddingRequest;
	if (!request || typeof request.requestId !== 'number' || !request.action) return;
	// eslint-disable-next-line promise/prefer-await-to-then -- a promise chain is the serialisation itself; an async handler would re-parallelise
	queue = queue.then(() => handle(request));
});
