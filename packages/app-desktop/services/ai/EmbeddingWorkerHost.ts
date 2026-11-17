import { utilityProcess, UtilityProcess } from 'electron';
import Logger from '@joplin/utils/Logger';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { EmbeddingRequest, EmbeddingResponse, PendingEntry, isErrorResponse } from './embeddingWorkerProtocol';

// Forks and owns the embedding utility process. All requests come from the
// renderer over the embeddingRequest IPC channel; the ONNX inference itself
// runs entirely off the UI threads.

// After this many consecutive failures, stop re-forking — a broken worker
// would otherwise be respawned on every indexer tick.
const MaxConsecutiveFailures = 3;

interface ForkOptions {
	// Test seam: lets unit tests inject a fake utility process.
	fork?: (modulePath: string, args?: string[], options?: { serviceName: string; stdio: string })=> UtilityProcess;
}

export default class EmbeddingWorkerHost {

	private logger_: Logger;
	private forkImpl_: ForkOptions['fork'];
	private child_: UtilityProcess | null = null;
	private spawnPromise_: Promise<UtilityProcess> | null = null;
	private nextRequestId_ = 1;
	private pending_ = new Map<number, PendingEntry>();
	private consecutiveFailures_ = 0;
	private disposed_ = false;

	public constructor(logger: Logger, options: ForkOptions = {}) {
		this.logger_ = logger;
		this.forkImpl_ = options.fork ?? ((modulePath, args, options) => utilityProcess.fork(modulePath, args, options));
	}

	public isAvailable(): boolean {
		if (this.disposed_) return false;
		// A probe, not a fork: the app consults this at startup to decide
		// whether to install the local embedding provider at all.
		if (!existsSync(this.workerPath_())) return false;
		return existsSync(this.onnxBindingPath_());
	}

	private isPackaged_(): boolean {
		return __dirname.includes('app.asar');
	}

	private workerPath_(): string {
		// main.bundle.js sits in app.asar's root, so the packaged worker is a
		// sibling in the unpacked mirror; in dev both live in packages/app-desktop.
		return this.isPackaged_()
			? join(__dirname, '..', 'app.asar.unpacked', 'embeddingWorker.bundle.js')
			: join(__dirname, 'embeddingWorker.bundle.js');
	}

	// The binding ships in asarUnpack's mirror; check it there so the probe
	// reflects what the worker will actually load. Mirrors the sqlite-vec path
	// rewrite in main-html.ts. The binding entry is version-independent (the
	// dylib it loads is versioned) — probing the dylib by name would silently
	// break on every onnxruntime-node upgrade.
	private onnxBindingPath_(): string {
		try {
			// eslint-disable-next-line @typescript-eslint/no-var-requires -- resolve only; must not load the binding
			const entry = require.resolve('onnxruntime-node');
			const packageDir = join(dirname(dirname(entry)), 'bin', 'napi-v6', process.platform, process.arch);
			const unpacked = packageDir.replace('app.asar', 'app.asar.unpacked');
			return join(unpacked, 'onnxruntime_binding.node');
		} catch {
			return '';
		}
	}

	public async handleRequest(action: EmbeddingRequest['action'], payload: EmbeddingRequest['payload']): Promise<null | number[][]> {
		if (this.disposed_) throw new Error('Embedding worker host is disposed');
		if (this.consecutiveFailures_ >= MaxConsecutiveFailures) {
			throw new Error('Embedding worker failed repeatedly; local embeddings are disabled until restart');
		}

		const child = await this.ensureWorker_();

		const request: EmbeddingRequest = {
			requestId: this.nextRequestId_++,
			action,
			payload,
		};

		return new Promise((resolve, reject) => {
			this.pending_.set(request.requestId, { resolve, reject });
			child.postMessage(request);
		});
	}

	private ensureWorker_(): Promise<UtilityProcess> {
		if (this.child_) return Promise.resolve(this.child_);
		// eslint-disable-next-line promise/prefer-await-to-then -- finally() keeps the single-flight cache shape without a wrapper
		this.spawnPromise_ ??= this.spawnWorker_().finally(() => {
			this.spawnPromise_ = null;
		});
		return this.spawnPromise_;
	}

	private async spawnWorker_(): Promise<UtilityProcess> {
		this.logger_.info('Starting embedding utility process');
		const child = this.forkImpl_(this.workerPath_(), [], {
			serviceName: 'joplin-embedding-worker',
			stdio: 'inherit',
		});

		child.on('message', (response: EmbeddingResponse) => {
			const pending = this.pending_.get(response.requestId);
			if (!pending) return;
			this.pending_.delete(response.requestId);

			if (isErrorResponse(response)) {
				this.consecutiveFailures_++;
				pending.reject(new Error(response.error.message));
			} else {
				this.consecutiveFailures_ = 0;
				pending.resolve(response.result);
			}
		});

		// A non-dispose exit is a worker crash — it must count toward the
		// circuit breaker or a worker that dies on startup (broken native
		// binding) would be re-forked on every indexer tick.
		let exited = false;
		child.on('exit', code => {
			exited = true;
			if (this.child_ === child) this.child_ = null;
			this.logger_.info(`Embedding utility process exited with code ${code}`);
			if (!this.disposed_) this.consecutiveFailures_++;
			this.failAllPending_(new Error('Embedding utility process exited'));
		});

		try {
			await new Promise<void>((resolve, reject) => {
				child.once('spawn', () => resolve());
				child.once('exit', () => reject(new Error('Embedding utility process exited while starting')));
			});
		} catch (error) {
			if (!exited) this.consecutiveFailures_++;
			throw error;
		}

		// disposeAll can race a spawn in flight — don't resurrect a child on a
		// disposed host (it would never be killed).
		if (this.disposed_) {
			child.kill();
			throw new Error('Embedding worker host is disposed');
		}

		this.child_ = child;
		return child;
	}

	private failAllPending_(error: Error) {
		for (const [requestId, pending] of this.pending_) {
			this.pending_.delete(requestId);
			pending.reject(error);
		}
	}

	public disposeAll() {
		this.disposed_ = true;
		this.failAllPending_(new Error('Embedding worker host is disposed'));
		this.child_?.kill();
		this.child_ = null;
		this.spawnPromise_ = null;
	}
}
