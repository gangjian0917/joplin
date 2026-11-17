// Pure inference core for the local embedding model. Extracted from
// LocalEmbeddingProvider so it can be inlined into the desktop utility-process
// worker bundle without dragging in shim/Setting/the model downloader.

// Capped to keep background indexing from pegging every core.
export const INTRA_OP_NUM_THREADS = 2;

// Cap on how many texts go through a single ONNX run. The peak working set of
// a transformer pass scales with batch_size × seq_len × hidden_dim × layers.
// On a fat note (hundreds of chunks), feeding everything at once produces a
// tensor large enough to crash the worker on low-free-memory machines
// (#15761). 8 keeps the per-call peak below ~100MB while still amortising the
// session.run() overhead.
export const MAX_EMBED_BATCH = 8;

// Fixed at the model's known output size — the sqlite-vec table dimension
// is set on first create() and must match.
export const E5_SMALL_DIMENSION = 384;

export const MODEL_FILE_NAME = 'model_quantized.onnx';

export interface OnnxSession {
	run(feeds: Record<string, OnnxTensor>): Promise<Record<string, OnnxTensor>>;
	inputNames?: string[];
	release?(): void;
}

export interface OnnxTensor {
	data: Float32Array | BigInt64Array;
	dims: number[];
}

export interface OnnxRuntime {
	InferenceSession: {
		create(modelPath: string, options?: unknown): Promise<OnnxSession>;
	};
	Tensor: new (type: string, data: Float32Array | BigInt64Array | number[], dims: number[])=> OnnxTensor;
}

export interface Tokenizer {
	(texts: string[], options?: { padding?: boolean; truncation?: boolean; max_length?: number }): {
		input_ids: { data: BigInt64Array; dims: number[] };
		attention_mask: { data: BigInt64Array; dims: number[] };
		token_type_ids?: { data: BigInt64Array; dims: number[] };
	};
}

export interface TransformersModule {
	env: { localModelPath: string; allowRemoteModels: boolean; allowLocalModels: boolean };
	AutoTokenizer: { from_pretrained: (name: string)=> Promise<Tokenizer> };
}

export const sessionOptions = () => ({
	executionProviders: ['cpu'],
	intraOpNumThreads: INTRA_OP_NUM_THREADS,
	graphOptimizationLevel: 'all',
});

export const loadTokenizerFromModule = async (transformers: TransformersModule, modelDir: string, archiveName: string): Promise<Tokenizer> => {
	// transformers.js resolves model_id against env.localModelPath, so we
	// point it at the parent and pass the model dir name as the id.
	// allowRemoteModels=false stops it falling back to huggingface.co.
	transformers.env.localModelPath = `${modelDir}/..`;
	transformers.env.allowRemoteModels = false;
	transformers.env.allowLocalModels = true;
	const tokenizer = await transformers.AutoTokenizer.from_pretrained(archiveName);
	return tokenizer as Tokenizer;
};

export default class LocalEmbeddingInference {

	private ort_: OnnxRuntime;
	private tokenizer_: Tokenizer;
	private session_: OnnxSession | null = null;

	public constructor(ort: OnnxRuntime, tokenizer: Tokenizer) {
		this.ort_ = ort;
		this.tokenizer_ = tokenizer;
	}

	public async createSession(modelDir: string): Promise<void> {
		if (this.session_) {
			this.session_.release?.();
			this.session_ = null;
		}
		this.session_ = await this.ort_.InferenceSession.create(`${modelDir}/${MODEL_FILE_NAME}`, sessionOptions());
	}

	public async embed(prefixedTexts: string[]): Promise<number[][]> {
		// Split into mini-batches so a note with hundreds of chunks doesn't
		// produce one huge tensor — see MAX_EMBED_BATCH.
		const results: number[][] = [];
		for (let i = 0; i < prefixedTexts.length; i += MAX_EMBED_BATCH) {
			const slice = prefixedTexts.slice(i, i + MAX_EMBED_BATCH);
			const vectors = await this.runEmbedBatch(slice);
			for (const v of vectors) results.push(v);
		}
		return results;
	}

	private async runEmbedBatch(prefixed: string[]): Promise<number[][]> {
		const tokenized = this.tokenizer_(prefixed, {
			padding: true,
			truncation: true,
			max_length: 512,
		});

		const ort = this.ort_;
		const inputIds = new ort.Tensor('int64', tokenized.input_ids.data, tokenized.input_ids.dims);
		const attentionMask = new ort.Tensor('int64', tokenized.attention_mask.data, tokenized.attention_mask.dims);

		const feeds: Record<string, OnnxTensor> = {
			input_ids: inputIds,
			attention_mask: attentionMask,
		};
		// e5's ONNX export declares token_type_ids as a required input even
		// though XLM-RoBERTa is single-segment. transformers.js doesn't emit
		// it, so we synthesise a zero tensor when the session asks for one.
		if (this.session_!.inputNames?.includes('token_type_ids')) {
			const ttiData = tokenized.token_type_ids?.data
				?? new BigInt64Array(tokenized.input_ids.data.length);
			feeds.token_type_ids = new ort.Tensor('int64', ttiData, tokenized.input_ids.dims);
		}

		const output = await this.session_!.run(feeds);
		const lastHidden = output.last_hidden_state ?? output.token_embeddings ?? Object.values(output)[0];

		return meanPoolAndNormalise(
			lastHidden.data as Float32Array,
			lastHidden.dims,
			tokenized.attention_mask.data,
		);
	}
}

// Mean-pools token embeddings over the attention mask, then L2-normalises.
// Returns one vector per row. Public for test reach-in.
export const meanPoolAndNormalise = (
	hiddenStates: Float32Array,
	dims: number[],
	attentionMask: BigInt64Array,
): number[][] => {
	const [batch, seqLen, hidden] = dims;
	const out: number[][] = [];

	for (let b = 0; b < batch; b++) {
		const vec = new Array<number>(hidden).fill(0);
		let count = 0;
		for (let t = 0; t < seqLen; t++) {
			if (attentionMask[b * seqLen + t] === BigInt(0)) continue;
			count++;
			const base = (b * seqLen + t) * hidden;
			for (let h = 0; h < hidden; h++) {
				vec[h] += hiddenStates[base + h];
			}
		}
		if (count > 0) {
			for (let h = 0; h < hidden; h++) vec[h] /= count;
		}
		let norm = 0;
		for (let h = 0; h < hidden; h++) norm += vec[h] * vec[h];
		norm = Math.sqrt(norm);
		if (!Number.isFinite(norm)) {
			throw new Error(`meanPoolAndNormalise: non-finite norm at batch index ${b}`);
		}
		if (norm > 0) {
			for (let h = 0; h < hidden; h++) vec[h] /= norm;
		}
		out.push(vec);
	}

	return out;
};
