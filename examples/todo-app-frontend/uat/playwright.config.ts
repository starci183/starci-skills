import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * ops/uat.verify/operator.yaml's "recording: screenshots-and-real-video" and the run's own
 * `runs/<runId>/` folder are two different things: Playwright writes its raw per-test artifacts
 * (screenshots, `.webm` video, trace) into `outputDir` below, and `./lib/run-writer.ts` (the
 * `reporter`) copies the finalized ones out into the owning `.starciwork` node once each test settles.
 * `outputDir` therefore lives outside this repository, in the OS temp directory, so a crashed run never
 * leaves half-written bytes inside a tracked tree.
 */
const RAW_OUTPUT_DIR = path.join(os.tmpdir(), 'todo-app-uat-raw');

export default defineConfig({
  testDir: './flows',
  globalSetup: './global-setup.ts',
  outputDir: RAW_OUTPUT_DIR,
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['./lib/run-writer.ts']],
  use: {
    baseURL: process.env.UAT_BASE_URL ?? 'http://localhost:3000',
    video: 'on',
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
