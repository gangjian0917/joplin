import LocalEmbeddingInference, { meanPoolAndNormalise } from './LocalEmbeddingInference';
import { HIDDEN, makeFakeOnnxRuntime, makeFakeTokenizer } from './testing/fakeOnnx';

describe('LocalEmbeddingInference', () => {

	it('splits large inputs into mini-batches to cap peak ONNX memory', async () => {
		// Fat notes can produce hundreds of chunks; feeding them all to ONNX in
		// one tensor blows up the worker on low-free-memory machines
		// (see #15761). The inference must split into ≤ MAX_EMBED_BATCH-sized
		// sub-batches and return the concatenated result in order.
		const runs: number[] = [];
		const onnx = makeFakeOnnxRuntime();
		const realCreate = onnx.InferenceSession.create;
		onnx.InferenceSession.create = async () => {
			const session = await realCreate();
			const realRun = session.run;
			session.run = async feeds => {
				runs.push(feeds.input_ids.dims[0]);
				return realRun(feeds);
			};
			return session;
		};

		const inference = new LocalEmbeddingInference(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test fakes intentionally loose
			onnx as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test fakes intentionally loose
			makeFakeTokenizer(4) as any,
		);
		await inference.createSession('');

		const inputs = Array.from({ length: 20 }, (_, i) => `t${i}`);
		const vectors = await inference.embed(inputs);

		expect(vectors).toHaveLength(20);
		// 20 inputs / batch 8 → 8, 8, 4
		expect(runs).toEqual([8, 8, 4]);
		expect(vectors[0]).toHaveLength(HIDDEN);
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

	it('throws when the model produces non-finite values', () => {
		const hidden = new Float32Array([1, NaN, 3, 4]);
		const mask = new BigInt64Array([BigInt(1), BigInt(1)]);
		expect(() => meanPoolAndNormalise(hidden, [1, 2, 2], mask)).toThrow(/non-finite/);
	});
});
