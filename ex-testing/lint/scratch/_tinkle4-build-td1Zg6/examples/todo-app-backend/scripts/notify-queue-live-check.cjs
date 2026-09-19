// Evidence helper for integration.notify.queue: a real enqueue/dequeueDue round trip against the real
// dev Redis (never a fake) - the command example-evidence.mjs's --assert runs for that record.
// Usage: node -r ts-node/register/transpile-only -r tsconfig-paths/register scripts/notify-queue-live-check.cjs
const { NotifyQueueClient } = require('../src/modules/integrations/notify-queue/notify-queue.client');
const { AppConfigService } = require('../src/modules/platform/config/app-config.service');

(async () => {
  const client = new NotifyQueueClient(new AppConfigService());
  const jobId = `live-proof-check:${Date.now()}`;
  await client.enqueue(jobId, Date.now() - 1000);
  const due = await client.dequeueDue(Date.now());
  if (!due.includes(jobId)) {
    throw new Error(`job not returned by dequeueDue: ${JSON.stringify(due)}`);
  }
  const again = await client.dequeueDue(Date.now());
  if (again.includes(jobId)) {
    throw new Error('job returned twice from dequeueDue');
  }
  console.log('OK real redis enqueue/dequeueDue round trip:', jobId);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
