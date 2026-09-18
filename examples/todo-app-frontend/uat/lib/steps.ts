import type { Page, TestInfo } from '@playwright/test';
import { test } from '@playwright/test';

/**
 * One walked checkpoint, carried out of the worker process through `TestInfo.annotations` (a plain
 * string, so the JSON is inlined) because a custom reporter runs in a different process than the test
 * body and cannot read a module-level variable the spec set. The matching screenshot is attached under
 * the same `name` so the reporter can zip the two back together without guessing by position.
 */
export type WalkStepRecord = {
  readonly step: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly screenshot: string;
};

export const WALK_STEP_ANNOTATION = 'uat-walk-step';

/**
 * One yes/no UX or business observation, per ops/uat.verify/operator.yaml's
 * "UX answers are yes/no for observed loading feedback, error feedback, skeleton, validation,
 * retry/recovery and completion ... Specify expected yes or no and applicability before running."
 * `observed` stays `'not-run'` - never a guessed yes/no - when this environment could not reach the
 * checkpoint at all.
 */
export type AssertionRecord = {
  readonly id: string;
  readonly expected: 'yes' | 'no';
  readonly observed: 'yes' | 'no' | 'not-run';
  readonly note: string;
};

export const ASSERTION_ANNOTATION = 'uat-assertion';

/** Appends one structured assertion outcome to this test's evidence trail. */
export const recordAssertion = (testInfo: TestInfo, entry: AssertionRecord): void => {
  testInfo.annotations.push({ type: ASSERTION_ANNOTATION, description: JSON.stringify(entry) });
};

/**
 * Runs one named checkpoint of a flow as a real Playwright step, takes a full-page screenshot with any
 * password field masked, attaches it under the step's own name, and records the step's start/end time
 * so the reporter's `walk.json` can index screenshot-by-step-by-time exactly as the op requires.
 */
export const walkStep = async (
  page: Page,
  testInfo: TestInfo,
  name: string,
  action: () => Promise<void> | void,
): Promise<void> => {
  await test.step(name, async () => {
    const startedAt = new Date().toISOString();
    await action();
    const endedAt = new Date().toISOString();

    const passwordFields = page.locator('input[type="password"]');
    const maskCount = await passwordFields.count().catch(() => 0);
    const shotPath = testInfo.outputPath(`${name}.png`);
    await page.screenshot({ path: shotPath, mask: maskCount > 0 ? [passwordFields] : [] });
    await testInfo.attach(name, { path: shotPath, contentType: 'image/png' });

    const record: WalkStepRecord = { step: name, startedAt, endedAt, screenshot: name };
    testInfo.annotations.push({ type: WALK_STEP_ANNOTATION, description: JSON.stringify(record) });
  });
};
