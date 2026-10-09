// The Kernel seat guard and the ack verbs (both spellings): the plan and the attestation are allowed; a redirection into a file is refused (KERNEL_NO_FILE_WRITE),
// which is why the attestation takes the readToken of the plan instead of a manifest file. The note of 2026-10-09 12:56 ("guard seat refused ack-rev") is that
// refusal of `--plan > manifest.json`: the Kernel had no way to write the file the old attestation demanded.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hookDecision } from '../../scripts/guards/command-guard.mjs';
import { bindGuardTerminal, guardLaunch } from '../../scripts/guards/hook-install.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

function seat(t, role) {
  const skillRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-kack-root-')));
  t.after(() => fs.rmSync(skillRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const { receipt } = guardLaunch({ skillRoot, jobId: `${role}-wf-x`, workflowId: 'wf-x', ledgerRepo: ROOT, owned: [], repos: [], role, workflowWorktree: ROOT });
  const handle = `term_kack-${role}-${process.pid}`;
  bindGuardTerminal({ skillRoot, handle, jobFile: receipt.jobFile });
  const env = { ...process.env, ORCA_TERMINAL_HANDLE: handle };
  return async (command) => (await hookDecision({ tool_name: 'Bash', cwd: ROOT, tool_input: { command } }, { env, root: skillRoot }))?.verdict?.code ?? null;
}

for (const verb of ['kernel-ack-rev', 'revision-ack']) {
  test(`${verb}: the Kernel seat may plan it and attest it by readToken or by manifest file; it may not write the file with a redirection`, async (t) => {
    const run = await seat(t, 'kernel');
    assert.equal(await run(`starci kernel ${verb} --workflow wf-x --plan`), null);
    assert.equal(await run(`starci kernel ${verb} --workflow wf-x --plan --op work.author`), null);
    assert.equal(await run(`starci kernel ${verb} --workflow wf-x --rev abc123 --digest ${'a'.repeat(64)}`), null);
    assert.equal(await run(`starci kernel ${verb} --workflow wf-x --rev abc123 --read-manifest /tmp/manifest.json`), null);
    assert.equal(await run(`starci kernel ${verb} --workflow wf-x --plan > manifest.json`), 'KERNEL_NO_FILE_WRITE');
    assert.equal(await run(`starci kernel ${verb} --workflow wf-x --plan --json | tee manifest.json`), 'KERNEL_STARCI_ONLY');
  });
}
