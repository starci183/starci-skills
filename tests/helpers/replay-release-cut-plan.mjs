// replay-release-cut-plan.mjs — exercise the cut's default L4 adapter with real tiny fixture commands; outer host/remote effects stay private.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cutRelease } from '../../scripts/supervisor/release-cut.mjs';
import { planL4 } from '../../scripts/supervisor/release-l4.mjs';

/** Run the actual default cut runner in a private runtime fixture; a deliberately red check keeps tagging and pushing unreachable. */
export async function replayReleaseCutPlan(t, mode) {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-cut-plan-replay-')));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({
    name: 'private-release-fixture', version: '1.0.0-alpha.9',
    scripts: { test: 'node --test toy.spec.mjs', 'test:packages': 'node -e "process.exit(0)"', check: 'node -e "process.exit(1)"' },
  }));
  const marker = path.join(repo, 'local-suite-ran');
  fs.writeFileSync(path.join(repo, 'toy.spec.mjs'), [
    "import test from 'node:test';", "import fs from 'node:fs';",
    "test('private toy command', () => fs.writeFileSync('local-suite-ran', 'ran'));", '',
  ].join('\n'));
  const plan = planL4(repo, { runtimeRoot: repo, mode });
  let parityCalls = 0;
  const git = ([verb, ...args]) => {
    if (verb === 'symbolic-ref') return { ok: true, stdout: 'main', stderr: '' };
    if (verb === 'status' || verb === 'tag' || verb === 'ls-remote') return { ok: true, stdout: '', stderr: '' };
    if (verb === 'rev-parse') return { ok: true, stdout: 'a'.repeat(40), stderr: '' };
    throw new Error(`Unexpected fixture git call: ${verb} ${args.join(' ')}`);
  };
  const previousTempRoot = process.env.STARCI_TEMP_ROOT;
  process.env.STARCI_TEMP_ROOT = path.join(repo, 'temporary');
  let out;
  try {
    out = await cutRelease({ repo, tag: 'v1.0.0-alpha.9', deps: {
    git, runtimeRoot: repo, suiteMode: () => mode, treeEntries: () => [], ledgers: () => [],
    changelog: () => '## [1.0.0-alpha.9] — 2026-10-10\n\n- shipped\n',
    findings: () => [], host: () => [], jsonExceptions: () => ({ offenders: [], missingAllowlist: [] }),
    publishPlan: () => ({ blockers: [], toPublish: [] }), proofs: {}, lock: (work) => work(),
    writeLedger: () => ({ ok: true }),
    parity: () => { parityCalls += 1; return { name: 'linux-parity', ok: false, log: null, ms: 0, skips: [] }; },
    push: () => { throw new Error('A fixture cut must never push'); },
    } });
  } finally {
    if (previousTempRoot === undefined) delete process.env.STARCI_TEMP_ROOT;
    else process.env.STARCI_TEMP_ROOT = previousTempRoot;
  }
  return { out, plan, parityCalls, localSuiteRan: fs.existsSync(marker) };
}
