import { makeRunId } from './lib/run-context';

/**
 * Runs once in the main process before any worker starts. Computing the run's one `<UTC
 * stamp>-<short sha>` id here, instead of in each worker or in the reporter, is what lets every flow
 * this invocation runs - and the reporter that writes their evidence - agree on the exact same runId.
 */
export default function globalSetup(): void {
  process.env.UAT_RUN_ID = makeRunId();
}
