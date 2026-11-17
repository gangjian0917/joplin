// Fake ONNX runtime + tokenizer shared by LocalEmbeddingProvider and
// LocalEmbeddingInference tests. Deterministic: each token's hidden vector is
// a function of (token value, hidden index) so different inputs produce
// different pooled outputs.

export const HIDDEN = 8;

export interface FakeTokenized {
	input_ids: { data: BigInt64Array; dims: number[] };
	attention_mask: { data: BigInt64Array; dims: number[] };
}

export const makeFakeTokenizer = (perTextTokenCount: number) => {
	return (texts: string[]): FakeTokenized => {
		const batch = texts.length;
		const seqLen = perTextTokenCount;
		const ids = new BigInt64Array(batch * seqLen);
		const mask = new BigInt64Array(batch * seqLen);
		for (let b = 0; b < batch; b++) {
			for (let t = 0; t < seqLen; t++) {
				ids[b * seqLen + t] = BigInt(((b + 1) * (t + 1)) % 100);
				mask[b * seqLen + t] = BigInt(1);
			}
		}
		return {
			input_ids: { data: ids, dims: [batch, seqLen] },
			attention_mask: { data: mask, dims: [batch, seqLen] },
		};
	};
};

export const makeFakeOnnxRuntime = () => {
	class FakeTensor {
		public data: Float32Array | BigInt64Array;
		public dims: number[];
		public constructor(_type: string, data: Float32Array | BigInt64Array | number[], dims: number[]) {
			this.data = Array.isArray(data) ? new Float32Array(data) : data;
			this.dims = dims;
		}
	}

	const session = {
		run: async (feeds: Record<string, FakeTensor>) => {
			const [batch, seqLen] = feeds.input_ids.dims;
			const out = new Float32Array(batch * seqLen * HIDDEN);
			const ids = feeds.input_ids.data as BigInt64Array;
			for (let b = 0; b < batch; b++) {
				for (let t = 0; t < seqLen; t++) {
					const idVal = Number(ids[b * seqLen + t]);
					for (let h = 0; h < HIDDEN; h++) {
						out[(b * seqLen + t) * HIDDEN + h] = (idVal + h + 1) / 100;
					}
				}
			}
			return {
				last_hidden_state: {
					data: out,
					dims: [batch, seqLen, HIDDEN],
				},
			};
		},
	};

	return {
		InferenceSession: { create: async () => session },
		Tensor: FakeTensor,
	};
};
