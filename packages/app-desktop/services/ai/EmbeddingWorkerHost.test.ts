import EmbeddingWorkerHost from './EmbeddingWorkerHost';
import Logger from '@joplin/utils/Logger';
import { EventEmitter } from 'events';

// Fake UtilityProcess: emits spawn asynchronously (like a real fork that
// starts successfully) and records posted messages so tests can reply by
// requestId.
class FakeChild extends EventEmitter {
	public posted: unknown[] = [];
	public killed = false;

	public constructor() {
		super();
		setTimeout(() => this.emit('spawn'), 0);
	}

	public postMessage(message: unknown) {
		this.posted.push(message);
	}

	public kill() {
		this.killed = true;
	}

	public reply(requestId: number, result: null | number[][]) {
		this.emit('message', { requestId, ok: true, result });
	}
}

const makeHost = () => {
	let lastChild: FakeChild | null = null;
	const host = new EmbeddingWorkerHost(new Logger(), {
		fork: () => {
			lastChild = new FakeChild();
			return lastChild as unknown as import('electron').UtilityProcess;
		},
	});
	// handleRequest() forks inside its first await, so by the time a request
	// promise exists the child is already reachable.
	const childOf = (pending: Promise<unknown>) => {
		// eslint-disable-next-line promise/prefer-await-to-then -- explicit fire-and-forget suppress
		void pending.catch(() => {});
		expect(lastChild).not.toBeNull();
		return lastChild!;
	};
	return { host, childOf };
};

describe('EmbeddingWorkerHost', () => {

	it('routes requests to the worker by requestId', async () => {
		const { host, childOf } = makeHost();

		const pending = host.handleRequest('embed', { texts: ['hello'], prefix: 'query: ' });
		const child = childOf(pending);
		await new Promise(resolve => setTimeout(resolve, 5));
		expect(child.posted).toHaveLength(1);
		expect(child.posted[0]).toMatchObject({ action: 'embed', payload: { texts: ['hello'] } });

		const request = child.posted[0] as { requestId: number };
		child.reply(request.requestId, [[0.5, 0.5]]);
		expect(await pending).toEqual([[0.5, 0.5]]);
	});

	it('reuses one worker across requests', async () => {
		const { host, childOf } = makeHost();

		const first = host.handleRequest('init', { modelDir: '/m', archiveName: 'a' });
		const child = childOf(first);
		await new Promise(resolve => setTimeout(resolve, 5));
		child.reply((child.posted[0] as { requestId: number }).requestId, null);
		await first;

		const second = host.handleRequest('embed', { texts: ['x'], prefix: 'passage: ' });
		await new Promise(resolve => setTimeout(resolve, 5));
		expect(child.posted).toHaveLength(2);
		child.reply((child.posted[1] as { requestId: number }).requestId, []);
		expect(await second).toEqual([]);
	});

	it('rejects pending requests when the worker exits', async () => {
		const { host, childOf } = makeHost();

		const pending = host.handleRequest('embed', { texts: ['hello'], prefix: 'query: ' });
		const child = childOf(pending);
		await new Promise(resolve => setTimeout(resolve, 5));

		child.emit('exit', 1);

		await expect(pending).rejects.toThrow(/exited/);
	});

	it('stops accepting requests after repeated failures', async () => {
		const { host, childOf } = makeHost();

		const first = host.handleRequest('embed', { texts: ['x'], prefix: 'query: ' });
		const child = childOf(first);
		await new Promise(resolve => setTimeout(resolve, 5));
		child.emit('message', { requestId: (child.posted[0] as { requestId: number }).requestId, ok: false, error: { message: 'synthetic' } });
		await expect(first).rejects.toThrow(/synthetic/);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- white-box reach-in to bump the failure counter
		(host as any).consecutiveFailures_ = 3;

		await expect(host.handleRequest('embed', { texts: ['x'], prefix: 'query: ' }))
			.rejects.toThrow(/disabled until restart/);
	});

	it('kills the worker on dispose and rejects new requests', async () => {
		const { host, childOf } = makeHost();

		const pending = host.handleRequest('init', { modelDir: '/m', archiveName: 'a' });
		const child = childOf(pending);
		await new Promise(resolve => setTimeout(resolve, 5));

		host.disposeAll();

		expect(child.killed).toBe(true);
		await expect(pending).rejects.toThrow(/disposed/);
		await expect(host.handleRequest('embed', { texts: ['x'], prefix: 'query: ' }))
			.rejects.toThrow(/disposed/);
	});

	it('counts worker crashes toward the circuit breaker', async () => {
		// A worker that dies instead of replying (broken native binding, OOM)
		// must trip the breaker — spawn itself succeeds for such workers, so
		// only the exit counts.
		const { host, childOf } = makeHost();

		for (let i = 0; i < 3; i++) {
			const pending = host.handleRequest('embed', { texts: ['x'], prefix: 'query: ' });
			const child = childOf(pending);
			await new Promise(resolve => setTimeout(resolve, 5));
			child.emit('exit', 1);
			await expect(pending).rejects.toThrow(/exited/);
		}

		await expect(host.handleRequest('embed', { texts: ['x'], prefix: 'query: ' }))
			.rejects.toThrow(/disabled until restart/);
	});

	it('does not resurrect a worker spawned concurrently with dispose', async () => {
		// disposeAll while the first spawn is still pending must not leave the
		// freshly-spawned child attached (it would never be killed).
		const { host, childOf } = makeHost();

		const pending = host.handleRequest('embed', { texts: ['x'], prefix: 'query: ' });
		const child = childOf(pending);
		// Dispose before the async spawn event fires:
		host.disposeAll();
		await new Promise(resolve => setTimeout(resolve, 10));

		expect(child.killed).toBe(true);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- white-box inspection of the host's child slot
		expect((host as any).child_).toBeNull();
		await expect(pending).rejects.toThrow(/exited|disposed/);
	});
});
