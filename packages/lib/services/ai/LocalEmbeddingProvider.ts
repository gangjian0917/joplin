import Logger from '@joplin/utils/Logger';
import shim from '../../shim';
import { EmbeddingCompute, EmbeddingProvider, ProviderModelDownloadStatus, ProviderClassification } from './types';
import {
	MULTILINGUAL_E5_SMALL,
	ModelDescriptor,
	ProgressCallback,
	ensureModelDownloaded,
	localModelPath,
} from './EmbeddingModelDownloader';
import LocalEmbeddingInference, {
	E5_SMALL_DIMENSION,
	OnnxRuntime,
	Tokenizer,
	TransformersModule,
	loadTokenizerFromModule,
} from './LocalEmbeddingInference';

const logger = Logger.create('LocalEmbeddingProvider');

// Runs the bundled multilingual-e5-small model locally. Inference runs either
// in-process through shim.onnxRuntime() (non-desktop builds / tests) or in the
// desktop utility process via the injected `compute` seam — the synchronous
// ONNX run would otherwise block the renderer's main thread for seconds.

export interface LocalEmbeddingProviderOptions {
	model?: ModelDescriptor;
	onDownloadProgress?: ProgressCallback;
	// Injected by the desktop app: forwards batches to the embedding utility
	// process. Takes precedence over the in-process path.
	compute?: EmbeddingCompute;
	// Test-only seam: lets unit tests inject a fake ONNX runtime + tokenizer
	// without needing to download a real model. When both are set, the
	// download + transformers.js code paths are skipped entirely.
	overrides?: {
		onnxRuntime?: OnnxRuntime;
		tokenizer?: Tokenizer;
	};
}

export default class LocalEmbeddingProvider implements EmbeddingProvider {

	public readonly id = 'local';
	public readonly classification: ProviderClassification = 'local';
	public readonly modelId: string;
	public readonly dimension: number = E5_SMALL_DIMENSION;

	private model_: ModelDescriptor;
	private onDownloadProgress_?: ProgressCallback;
	private compute_?: EmbeddingCompute;
	private overrides_: LocalEmbeddingProviderOptions['overrides'];
	private initPromise_: Promise<void> | null = null;
	private initialised_ = false;
	private inference_: LocalEmbeddingInference | null = null;
	// Set while we're inside ensureModelDownloaded() so the status panel can
	// distinguish "downloading" from "not started" without polling disk.
	private downloadStatus_: ProviderModelDownloadStatus | null = null;

	public constructor(options: LocalEmbeddingProviderOptions = {}) {
		this.model_ = options.model ?? MULTILINGUAL_E5_SMALL;
		this.onDownloadProgress_ = options.onDownloadProgress;
		this.compute_ = options.compute;
		this.overrides_ = options.overrides;
		this.modelId = this.model_.id;
	}

	public async embed(texts: string[]): Promise<number[][]> {
		return this.runEmbed(texts, 'passage: ');
	}

	public async embedQuery(texts: string[]): Promise<number[][]> {
		return this.runEmbed(texts, 'query: ');
	}

	private async runEmbed(texts: string[], prefix: string): Promise<number[][]> {
		if (!texts.length) return [];

		await this.ensureInitialised();

		if (this.compute_) return this.compute_.embed(texts, prefix);

		// e5 is trained with asymmetric prefixes — "passage: " for documents,
		// "query: " for searches. Mixing them up measurably hurts retrieval.
		const prefixed = texts.map(t => `${prefix}${t}`);
		return this.inference_!.embed(prefixed);
	}

	private async ensureInitialised(): Promise<void> {
		if (this.initialised_) return;
		// Drop the cached promise on rejection so a transient failure can be
		// retried — otherwise every future caller inherits the failed promise.
		// eslint-disable-next-line promise/prefer-await-to-then -- await would need a wrapper to keep the single-flight cache shape
		this.initPromise_ ??= this.initialise().catch(error => {
			this.initPromise_ = null;
			throw error;
		});
		return this.initPromise_;
	}

	private async initialise(): Promise<void> {
		if (this.compute_) {
			const modelDir = await this.resolveModelDir();
			await this.compute_.init({ modelDir, archiveName: this.model_.archiveName });
			this.initialised_ = true;
			return;
		}

		const ort = this.getOnnxRuntime();
		if (!ort) {
			throw new Error('ONNX runtime is not available. Local embeddings require the desktop build.');
		}

		// Test seam: with both overrides supplied, skip the disk + ESM-import
		// paths entirely.
		if (this.overrides_?.onnxRuntime && this.overrides_?.tokenizer) {
			this.inference_ = new LocalEmbeddingInference(this.overrides_.onnxRuntime, this.overrides_.tokenizer);
			await this.inference_.createSession('');
			this.initialised_ = true;
			return;
		}

		const modelDir = await this.resolveModelDir();
		logger.info(`Loading embedding model from ${modelDir}`);
		this.inference_ = new LocalEmbeddingInference(ort, await this.loadTokenizer(modelDir));
		await this.inference_.createSession(modelDir);
		this.initialised_ = true;
	}

	private async resolveModelDir(): Promise<string> {
		this.downloadStatus_ = 'downloading';
		try {
			const dir = await ensureModelDownloaded(this.model_, { onProgress: this.onDownloadProgress_ });
			this.downloadStatus_ = 'downloaded';
			return dir;
		} catch (error) {
			this.downloadStatus_ = null;
			throw error;
		}
	}

	public async modelDownloadStatus(): Promise<ProviderModelDownloadStatus> {
		// In-flight download wins — the on-disk check still says "not started"
		// while the tarball is being fetched.
		if (this.downloadStatus_ === 'downloading') return 'downloading';
		const dir = await localModelPath(this.model_);
		if (dir) {
			this.downloadStatus_ = 'downloaded';
			return 'downloaded';
		}
		return this.downloadStatus_ ?? 'not-started';
	}

	private getOnnxRuntime(): OnnxRuntime | null {
		return (this.overrides_?.onnxRuntime ?? shim.onnxRuntime()) as OnnxRuntime | null;
	}

	private async loadTokenizer(modelDir: string): Promise<Tokenizer> {
		if (this.overrides_?.tokenizer) return this.overrides_.tokenizer;
		// See dynamicEsmImport.js for why this isn't a plain `await import()`.
		// eslint-disable-next-line @typescript-eslint/no-require-imports -- see dynamicEsmImport.js
		const dynamicImport = require('./dynamicEsmImport') as (s: string)=> Promise<TransformersModule>;
		const transformers = await dynamicImport('@huggingface/transformers');
		return loadTokenizerFromModule(transformers, modelDir, this.model_.archiveName);
	}
}

export { meanPoolAndNormalise } from './LocalEmbeddingInference';
