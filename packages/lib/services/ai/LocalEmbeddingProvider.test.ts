import { createTempDir, setupDatabaseAndSynchronizer, switchClient } from '../../testing/test-utils';
import Setting from '../../models/Setting';
import shim from '../../shim';
import * as fs from 'fs-extra';
import * as tar from 'tar';
import LocalEmbeddingProvider, { meanPoolAndNormalise } from './LocalEmbeddingProvider';
import { EmbeddingCompute } from './types';
import { ModelDescriptor } from './EmbeddingModelDownloader';
import { HIDDEN, makeFakeOnnxRuntime, makeFakeTokenizer } from './testing/fakeOnnx';

// Default tests use stubbed ONNX + tokenizer (no network, no 140 MB model).
// The bottom test opts in to the real download via JOPLIN_RUN_REAL_EMBEDDING_TEST=1.

const norm = (v: number[]) => Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));

describe('LocalEmbeddingProvider', () => {

	beforeEach(async () => {
		await setupDatabaseAndSynchronizer(1);
		await switchClient(1);
	});

	it('produces unit-norm vectors of the expected shape', async () => {
		const provider = new LocalEmbeddingProvider({
			overrides: {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test fakes intentionally loose
				onnxRuntime: makeFakeOnnxRuntime() as any,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test fakes intentionally loose
				tokenizer: makeFakeTokenizer(4) as any,
			},
		});

		const vectors = await provider.embed(['hello world', 'goodbye world']);
		expect(vectors).toHaveLength(2);
		expect(vectors[0]).toHaveLength(HIDDEN);
		expect(norm(vectors[0])).toBeCloseTo(1, 5);
		expect(norm(vectors[1])).toBeCloseTo(1, 5);
	});

	it('returns an empty array for empty input without initialising', async () => {
		// No overrides — embed([]) must early-return before any setup runs.
		const provider = new LocalEmbeddingProvider();
		expect(await provider.embed([])).toEqual([]);
	});

	it('exposes the model id and dimension for the indexer', () => {
		const provider = new LocalEmbeddingProvider();
		expect(provider.id).toBe('local');
		expect(provider.classification).toBe('local');
		expect(provider.modelId).toBe('multilingual-e5-small');
		expect(provider.dimension).toBe(384);
	});

	it('forwards batches through the compute seam with the e5 prefix', async () => {
		// A fake model + stubbed download so init() gets a real directory
		// without hitting the network or polluting the shared cache state.
		const tempDir = await createTempDir();
		const originalCacheDir = Setting.value('cacheDir');
		Setting.setConstant('cacheDir', tempDir);
		const fakeModel: ModelDescriptor = {
			id: 'fake-compute-model',
			archiveName: 'fake-compute-model',
			downloadUrl: 'https://example.invalid/fake-compute-model.tar.gz',
		};
		const stagingDir = `${tempDir}/staging`;
		await fs.mkdirp(stagingDir);
		await fs.writeFile(`${stagingDir}/config.json`, '{}');
		const archive = `${tempDir}/model.tar.gz`;
		await tar.create({ gzip: true, cwd: stagingDir, file: archive }, ['config.json']);

		const originalFetchBlob = shim.fetchBlob;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fetchBlob's options bag is loosely typed across implementations
		shim.fetchBlob = (async (_url: string, options: any) => {
			await fs.copy(archive, options.path);
			return { ok: true, status: 200, path: options.path };
		}) as typeof shim.fetchBlob;

		try {
			const initCalls: { modelDir: string; archiveName: string }[] = [];
			const embedCalls: { texts: string[]; prefix: string }[] = [];
			const compute: EmbeddingCompute = {
				init: async payload => {
					initCalls.push(payload);
				},
				embed: async (texts, prefix) => {
					embedCalls.push({ texts, prefix });
					return texts.map(() => Array.from({ length: 2 }, () => 0));
				},
			};

			const provider = new LocalEmbeddingProvider({ model: fakeModel, compute });
			await provider.embed(['doc one', 'doc two']);
			await provider.embedQuery(['search']);

			expect(initCalls).toHaveLength(1);
			expect(initCalls[0].modelDir).toContain('embedding-models');
			expect(initCalls[0].archiveName).toBe(fakeModel.archiveName);

			expect(embedCalls).toEqual([
				{ texts: ['doc one', 'doc two'], prefix: 'passage: ' },
				{ texts: ['search'], prefix: 'query: ' },
			]);
		} finally {
			shim.fetchBlob = originalFetchBlob;
			// setConstant is process-global and beforeEach doesn't reset it —
			// restore it or the remaining tests (incl. the gated real-download
			// one) would run against a deleted cacheDir.
			Setting.setConstant('cacheDir', originalCacheDir);
			await fs.remove(tempDir);
		}
	});

	it('mean-pools only over masked-in tokens', () => {
		// 1 batch, 3 tokens, 2 hidden dims. Mask out the middle token.
		const hidden = new Float32Array([
			1, 0, // t0
			9, 9, // t1 (masked out — should be ignored)
			0, 1, // t2
		]);
		const mask = new BigInt64Array([BigInt(1), BigInt(0), BigInt(1)]);
		const out = meanPoolAndNormalise(hidden, [1, 3, 2], mask);
		// Mean of [(1,0), (0,1)] = (0.5, 0.5), normalised = (√2/2, √2/2)
		expect(out[0][0]).toBeCloseTo(Math.SQRT1_2, 5);
		expect(out[0][1]).toBeCloseTo(Math.SQRT1_2, 5);
	});

	it('returns a zero vector (without dividing by zero) when nothing is masked in', () => {
		const hidden = new Float32Array([1, 2, 3, 4]);
		const mask = new BigInt64Array([BigInt(0), BigInt(0)]);
		const out = meanPoolAndNormalise(hidden, [1, 2, 2], mask);
		expect(out[0]).toEqual([0, 0]);
	});

	it('throws when the model produces non-finite values, instead of writing NaN to the index', () => {
		const hidden = new Float32Array([1, NaN, 3, 4]);
		const mask = new BigInt64Array([BigInt(1), BigInt(1)]);
		expect(() => meanPoolAndNormalise(hidden, [1, 2, 2], mask)).toThrow(/non-finite/);
	});

	it('modelDownloadStatus reports not-started when no cached model exists', async () => {
		const provider = new LocalEmbeddingProvider();
		// Without overrides and with a clean cache dir, the marker file is
		// absent — the status should be 'not-started'.
		expect(await provider.modelDownloadStatus()).toBe('not-started');
	});

	// Run via `yarn testEmbeddingProvider` (sets the env var + required
	// NODE_OPTIONS=--experimental-vm-modules). Stops short of running inference:
	// ONNX's output Float32Array crosses Jest's VM realm and `new ort.Tensor(...)`
	// rejects it as wrong-type. This does NOT happen in Electron.
	(process.env.JOPLIN_RUN_REAL_EMBEDDING_TEST === '1' ? it : it.skip)(
		'downloads and loads the real model (gated)',
		async () => {
			const provider = new LocalEmbeddingProvider();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- white-box reach-in to drive initialise() without calling embed()
			await (provider as any).ensureInitialised();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ditto
			expect((provider as any).inference_).toBeTruthy();
		},
		180_000,
	);
});
