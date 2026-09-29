// _supervisor-fixture.mjs — a machine.sqlite seeded the way the live Supervisor fills it (an act, a Kernel notice,
// owner feedback, a proposal, an inbox message and a reply; the retired supervisor tick wrote nothing since 2026-09-28), for the harness contract
// spec's fixture server and ui/fixtures/supervisor-*.json. Never the live home: the caller passes a temp env.
import { recordAction } from '../scripts/supervisor/actions.mjs';
import { notifyKernel } from '../scripts/supervisor/notify.mjs';
import { recordFeedback, propose } from '../scripts/supervisor/lessons.mjs';
import { withMachine } from '../engine/machine-db.mjs';

export const SEED_NOW = Date.parse('2026-09-28T12:00:00Z');

/** Seed `env`'s machine.sqlite (STARCI_TEST_MACHINE_FILE) with the Supervisor's state; returns {wf}. */
export async function seedSupervisorHome(env, { now = SEED_NOW } = {}) {
  const wf = 'wf-fixture-mission';
  recordAction({ item: `gate|${wf}|inc-0123456789ab`, action: 'resolve', reason: 'the record the gate named landed; resolved --by supervisor', workflowId: wf, env, now: now + 1000 });
  await notifyKernel({ repo: 'D:/fixture', workflowId: wf, text: 'inc-0123456789ab resolved by the supervisor: release the held job', item: `gate|${wf}|inc-0123456789ab`, env,
    wake: () => ({ action: 'delivered', delivered: true }) });
  recordFeedback({ text: 'owner: a peer wait over 2 h is always escalated to the peer Kernel', via: 'telegram', env, now: now + 2000, settings: { ownerWeight: 3 } });
  await propose({ title: 'Raise the daily autonomous-landing cap to 12', evidence: '9 routine fixes queued behind the cap', options: 'A keep 8; B raise to 12', recommendation: 'B', env, now: () => now + 3000 });
  withMachine((m) => {
    m.recordSupMessage({ direction: 'in', channel: 'telegram', chatId: '1', messageId: '7', text: '/status', at: now + 4000 });
    m.recordSupMessage({ direction: 'out', channel: 'telegram', to: 'owner', via: 'telegram', text: 'Status: 1 workflow engaged, 1 gate resolved.', ok: true, at: now + 5000 });
  }, { env });
  return { wf };
}
