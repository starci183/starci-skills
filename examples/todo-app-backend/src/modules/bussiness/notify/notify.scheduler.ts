import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotifyService } from './notify.service';

const TICK_MS = 5_000;

/**
 * nfr.notify.delivery.latency: the real wall-clock timer that closes a digest window and retries a
 * backed-off delivery. sds.notify.delivery-lifecycle's t-dispatch is triggered
 * `on: window-closed-or-immediate`; this is the "closed" half, driven by an actual interval rather than
 * by another `admit()` call happening to occur after the deadline. No unit spec in this module
 * constructs this class: every behaviour spec calls `NotifyService.runDueJobs` directly with an explicit
 * `now`, so correctness never depends on real elapsed time - this class is wiring, proven by
 * `notify.scheduler.spec.ts` only for start/stop, not for timing.
 */
@Injectable()
export class NotifyScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly notify: NotifyService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.notify.runDueJobs(new Date());
    }, TICK_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
