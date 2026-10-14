import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scriptHygieneFindings } from '../../scripts/hfs/rules/script-hygiene.mjs';
import { ALL_CHECK_CODES, checkRepo } from '../../scripts/hfs/check.mjs';
import { byCodeUnit } from '../../scripts/lib/list.mjs';

// proves: HFS_SCRIPT_PLAINTEXT_LOAD@lite HFS_SCRIPT_PLAINTEXT_LOAD@full
// proves: HFS_SCRIPT_XTRACE@lite HFS_SCRIPT_XTRACE@full
// proves: HFS_SERVICE_ROLE_SCOPE@lite HFS_SERVICE_ROLE_SCOPE@full

function fixture(t, entries, edition, extra = {}) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-script-hygiene-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(entries)) {
    fs.mkdirSync(path.dirname(path.join(repoRoot, file)), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, file), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return { repoRoot, files: Object.keys(entries), repo: { kind: 'app', profile: 'app', edition }, isRoot: true, ...extra };
}

for (const edition of ['lite', 'full']) {
  test(`HFS_SCRIPT_PLAINTEXT_LOAD: ${edition} refuses shell, PowerShell and source-code readers`, (t) => {
    const context = fixture(t, {
      'scripts/source.sh': 'source secrets.env\n',
      'deploy/dot.sh': '. "$HOME/.nivo-lite/secrets.env"\n',
      'scripts/cat.sh': 'cat ./secrets.env | parse\n',
      'scripts/input.sh': 'while read -r entry; do consume "$entry"; done < secrets.env\n',
      'scripts/load.ps1': 'Get-Content -LiteralPath .\\secrets.env\n',
      'scripts/alias.sh': 'SECRET_FILE=secrets.env\nsource "$SECRET_FILE"\n',
      'scripts/alias.mjs': 'const secretFile = "secrets.env"\nfs.readFileSync(secretFile, "utf8")\n',
      'scripts/load.mjs': 'fs.readFileSync(\n  "secrets.env", "utf8"\n)\n',
      'scripts/dotenv.mjs': 'dotenv.config({ path: ".env.production" })\n',
      'scripts/load.py': 'with open("secrets.env") as stream:\n    consume(stream.read())\n',
      'scripts/read-mode.py': 'open("secrets.env", "rb")\n',
      '.github/workflows/deploy.yml': 'jobs:\n  release:\n    steps:\n      - run: cat secrets.env\n',
    }, edition);
    const findings = scriptHygieneFindings(context);
    assert.deepEqual(findings.map((item) => item.path).sort(byCodeUnit), context.files.sort(byCodeUnit));
    assert.ok(findings.every((item) => item.code === 'HFS_SCRIPT_PLAINTEXT_LOAD' && item.level === 'error'));
    assert.ok(findings.every((item) => ALL_CHECK_CODES.includes(item.code)), 'plaintext findings retain bundled catalog explanations');
  });

  test(`HFS_SCRIPT_PLAINTEXT_LOAD: ${edition} accepts sealed CLI and metadata operations without reading secret files`, (t) => {
    const context = fixture(t, {
      'scripts/seal.sh': 'starci app secret materialize production\n',
      'deploy/metadata.sh': 'test -f secrets.env\nrm -f secrets.env\ncp .env.example template\n',
      'scripts/example.sh': 'cat .env.example\n',
      'scripts/ordinary.mjs': 'fs.readFileSync("input.json")\nconst note = "secrets.env"\n',
      'scripts/write.py': 'open("secrets.env", "w")\n',
      'scripts/append.py': 'open("secrets.env", "a")\n',
      'docs/guide.md': 'source secrets.env\n',
      'tests/custody.spec.mjs': 'source secrets.env\n',
      'secrets.env': 'content must never be read by this finder',
      '.claude/secret.env': 'content must never be read by this finder',
      '.starcistacks/production/secrets/api.enc': 'content must never be read by this finder',
    }, edition);
    const original = fs.readFileSync;
    const reads = [];
    fs.readFileSync = function (file, ...args) {
      reads.push(String(file).replaceAll('\\', '/'));
      return original.call(this, file, ...args);
    };
    let findings;
    try { findings = scriptHygieneFindings(context); } finally { fs.readFileSync = original; }
    assert.deepEqual(findings, []);
    assert.equal(reads.some((file) => file.endsWith('/secrets.env') || file.endsWith('/secret.env') || file.endsWith('.enc')), false);
  });

  test(`HFS_SCRIPT_XTRACE: ${edition} refuses set, shell invocation, shebang, workflows and reveal`, (t) => {
    const context = fixture(t, {
      'deploy/xtrace.sh': 'set -x\n',
      'scripts/combo.sh': 'set -euxo pipefail\n',
      'scripts/option.sh': 'set -o xtrace\n',
      'scripts/invoke.sh': 'bash -x deploy/run.sh\n',
      'scripts/absolute.sh': '/bin/bash --noprofile -o errexit -x deploy/run.sh\n',
      'scripts/shebang.sh': '#!/bin/bash -x\n',
      'scripts/options.sh': 'sh -o xtrace deploy/run.sh\n',
      'scripts/shellopts.sh': 'SHELLOPTS="errexit:xtrace:pipefail"\n',
      'scripts/many-options.sh': 'bash --noprofile --norc -o errexit -o pipefail -eux deploy/run.sh\n',
      'scripts/reveal.sh': 'starci app secret list production --reveal\n',
      '.github/workflows/release.yml': 'jobs:\n  release:\n    steps:\n      - shell: bash -x {0}\n        run: starci app secret materialize production\n',
      'package.json': { scripts: { release: 'bash -x deploy/run.sh' } },
    }, edition);
    const findings = scriptHygieneFindings(context);
    assert.deepEqual(findings.map((item) => item.path).sort(byCodeUnit), context.files.sort(byCodeUnit));
    assert.ok(findings.every((item) => item.code === 'HFS_SCRIPT_XTRACE'));
    assert.ok(findings.every((item) => ALL_CHECK_CODES.includes(item.code)), 'trace findings retain bundled catalog explanations');
  });

  test(`HFS_SCRIPT_XTRACE: ${edition} accepts tracing disabled and safe shell commands`, (t) => {
    const context = fixture(t, {
      'deploy/safe.sh': '# set -x is prohibited\nset +x\nset +o xtrace\nset -eu\nsh -c "starci app secret verify production"\n',
      'scripts/safe.mjs': '// bash -x and --reveal are forbidden\nrun("starci app secret verify production")\n',
      'scripts/options.sh': 'bash --noprofile -o errexit -o pipefail deploy/run.sh\nSHELLOPTS="errexit:pipefail"\n',
      'package.json': { description: 'avoid --reveal', scripts: { release: 'bash deploy/run.sh' } },
    }, edition);
    assert.deepEqual(scriptHygieneFindings(context).filter((item) => item.code === 'HFS_SCRIPT_XTRACE'), []);
  });

  test(`HFS_SERVICE_ROLE_SCOPE: ${edition} refuses delivery helpers, workflows, CLI and frontend source`, (t) => {
    const context = fixture(t, {
      'deploy/jobs.sh': 'node -e "createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)"\n',
      'scripts/client.mjs': 'const role = "service_role"\n',
      '.github/workflows/deploy.yml': 'env:\n  ROLE: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}\n',
      'be/src/features/cli/seed/seed.command.ts': 'const key = env.secret("SUPABASE_SERVICE_ROLE_KEY")\n',
      'be/src/modules/integrations/other/client.ts': 'const key = "SERVICE_ROLE"\n',
      'fe/apps/web/src/modules/auth/client.ts': 'const serviceRoleKey = env.secret("SUPABASE_SERVICE_ROLE_KEY")\n',
    }, edition);
    const findings = scriptHygieneFindings(context);
    assert.deepEqual(findings.map((item) => item.path).sort(byCodeUnit), context.files.sort(byCodeUnit));
    assert.ok(findings.every((item) => item.code === 'HFS_SERVICE_ROLE_SCOPE'));
    assert.ok(findings.every((item) => ALL_CHECK_CODES.includes(item.code)), 'service-role findings retain bundled catalog explanations');
    assert.ok(findings.every((item) => !item.message.includes('SUPABASE_SERVICE_ROLE_KEY') && !item.message.includes('createClient')));
  });

  test(`HFS_SERVICE_ROLE_SCOPE: ${edition} accepts the canonical integration and its config`, (t) => {
    const context = fixture(t, {
      'be/src/modules/integrations/supabase/supabase.config.ts': 'const serviceRoleKey = env.secret("SUPABASE_SERVICE_ROLE_KEY")\n',
      'be/src/modules/integrations/supabase/supabase.client.ts': 'const role = "service_role"\n',
      'be/apps/api/src/api.env.ts': 'const config = parseSupabaseConfig(env)\n',
      '.starcistacks/production/secrets/api.enc': 'SUPABASE_SERVICE_ROLE_KEY',
      'docs/security.md': 'service_role belongs only to the integration\n',
    }, edition, { resolver: { ownerOf: () => ({ slot: 'be.integrations.supabase' }) } });
    assert.deepEqual(scriptHygieneFindings(context).filter((item) => item.code === 'HFS_SERVICE_ROLE_SCOPE'), []);
  });

  test(`script hygiene: ${edition} honors scope and scans side source exactly once through checkRepo`, (t) => {
    const context = fixture(t, { 'be/scripts/task.sh': 'set -x\n', 'fe/scripts/task.sh': 'cat secrets.env\n' }, edition);
    const declaration = { hfs: 3, kind: 'app', project: 'demo', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } };
    const result = checkRepo({ repoRoot: context.repoRoot, files: context.files, declaration, tree: false });
    const codes = new Set(['HFS_SCRIPT_PLAINTEXT_LOAD', 'HFS_SCRIPT_XTRACE', 'HFS_SERVICE_ROLE_SCOPE']);
    assert.deepEqual(result.findings.filter((item) => codes.has(item.code)).map((item) => [item.code, item.path]).sort(byCodeUnit), [
      ['HFS_SCRIPT_PLAINTEXT_LOAD', 'fe/scripts/task.sh'], ['HFS_SCRIPT_XTRACE', 'be/scripts/task.sh'],
    ]);
    assert.deepEqual(scriptHygieneFindings({ ...context, inScope: (file) => file.startsWith('fe/') }).map((item) => item.path), ['fe/scripts/task.sh']);
    assert.deepEqual(scriptHygieneFindings({ ...context, isRoot: false }), []);
    assert.deepEqual(scriptHygieneFindings({ ...context, repo: { kind: 'runtime', edition } }), []);
  });
}
