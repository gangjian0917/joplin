import Setting, { Env } from './models/Setting';
import { reg } from './registry';
import shim from './shim';

const sync = {
	start: jest.fn().mockReturnValue({}),
};

describe('registry', () => {
	let originalSyncTarget: typeof reg.syncTarget;

	beforeAll(() => {
		Setting.setConstant('env', Env.Prod);
		originalSyncTarget = reg.syncTarget;
		reg.syncTarget = () => ({
			isAuthenticated: () => true,
			synchronizer: () => sync,
		});
	});

	afterAll(() => {
		Setting.setConstant('env', Env.Dev);
		reg.syncTarget = originalSyncTarget;
	});

	beforeEach(() => {
		jest.useFakeTimers();
		Setting.setValue('sync.interval', 300);
	});

	it('uses a 30-second quiet period for desktop edits', () => {
		const isElectron = jest.spyOn(shim, 'isElectron');
		try {
			isElectron.mockReturnValue(true);
			expect(reg.syncAsYouTypeInterval()).toBe(30 * 1000);

			isElectron.mockReturnValue(false);
			expect(reg.syncAsYouTypeInterval()).toBe(1000);
		} finally {
			isElectron.mockRestore();
		}
	});

	afterEach(() => {
		Setting.setValue('sync.interval', 0);
		reg.setupRecurrentSync();
	});

	describe('when on mobile data', () => {

		beforeEach(() => {
			Setting.setValue('sync.mobileWifiOnly', true);
			Setting.setValue('sync.target', 1);
			reg.setIsOnMobileData(true);
		});

		it('should not sync automatically', () => {
			reg.setupRecurrentSync();
			jest.runOnlyPendingTimers();

			expect(sync.start).toHaveBeenCalledTimes(0);
		});

		it('should sync if do wifi check is false', done => {
			void reg.scheduleSync(1, null, false)
			// eslint-disable-next-line promise/prefer-await-to-then -- Old code before rule was applied
				.then(() =>{
					expect(sync.start).toHaveBeenCalled();
					done();
				});

			jest.runOnlyPendingTimers();
		});

		it('should sync if "sync only over wifi" is disabled in settings', () => {
			Setting.setValue('sync.mobileWifiOnly', false);
			reg.setupRecurrentSync();
			jest.runOnlyPendingTimers();

			expect(sync.start).toHaveBeenCalled();
		});

	});

	describe('when not on mobile data', () => {

		beforeEach(() => {
			Setting.setValue('sync.mobileWifiOnly', true);
			reg.setIsOnMobileData(false);
		});

		it('should sync automatically', () => {
			reg.setupRecurrentSync();
			jest.runOnlyPendingTimers();

			expect(sync.start).toHaveBeenCalled();
		});

	});
});
