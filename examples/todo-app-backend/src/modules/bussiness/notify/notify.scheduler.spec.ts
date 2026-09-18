import { NotifyScheduler } from './notify.scheduler';
import { NotifyService } from './notify.service';

describe('NotifyScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ticks NotifyService.runDueJobs on an interval once started, and stops on destroy', () => {
    const runDueJobs = jest.fn().mockResolvedValue(undefined);
    const notify = { runDueJobs } as unknown as NotifyService;
    const scheduler = new NotifyScheduler(notify);

    scheduler.onModuleInit();
    jest.advanceTimersByTime(5_000);
    jest.advanceTimersByTime(5_000);
    expect(runDueJobs).toHaveBeenCalledTimes(2);

    scheduler.onModuleDestroy();
    jest.advanceTimersByTime(10_000);
    expect(runDueJobs).toHaveBeenCalledTimes(2);
  });
});
