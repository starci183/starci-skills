// proves: HFS_DEPENDABOT_MISSING@lite HFS_DEPENDABOT_MISSING@full
// proves: HFS_AUDIT_STEP_MISSING@lite HFS_AUDIT_STEP_MISSING@full
// proves: HFS_SBOM_MISSING@lite HFS_SBOM_MISSING@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { supplyChainFindings } from '../runtime/scripts/hfs/rules/supply-chain.mjs';
import { ALL_CHECK_CODES, checkRepo } from '../runtime/scripts/hfs/check.mjs';

const sha = 'a'.repeat(40);
const NPM_POLICY = '\n    groups:\n      minor-and-patch:\n        applies-to: version-updates\n        update-types: [minor, patch]\n      security:\n        applies-to: security-updates\n        update-types: [minor, patch]\n    ignore:\n      - dependency-name: "@starci/*"';
const ecosystemUpdates = ['npm', 'github-actions', 'docker'].map((ecosystem) => `  - package-ecosystem: ${ecosystem}\n    directory: /\n    schedule:\n      interval: weekly${ecosystem === 'npm' ? NPM_POLICY : ''}`).join('\n');
const dependabot = `version: 2\nupdates:\n${ecosystemUpdates}\n`;
const workflow = (steps) => `on:\n  push:\n    tags: [v*]\n  workflow_dispatch:\npermissions:\n  contents: read\nconcurrency: images-${'${{ github.ref }}'}\njobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n${steps}\n`;
const clean = {
  '.github/dependabot.yml': dependabot,
  '.github/workflows/ci.yml': workflow('      - run: npm audit --omit=dev --audit-level=high'),
  '.github/workflows/images.yml': workflow(`      - uses: docker/build-push-action@${sha}\n        with:\n          sbom: true\n          provenance: mode=max`),
};

function fixture(t, content, edition, extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-supply-chain-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [file, text] of Object.entries(content)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return { repoRoot: root, files: Object.keys(content), repo: { kind: 'app', edition }, isRoot: true, ...extra };
}
const codes = (ctx) => supplyChainFindings(ctx).map((finding) => finding.code);

for (const edition of ['lite', 'full']) {
  test(`HFS_DEPENDABOT_MISSING rejects absent or incomplete updates (${edition})`, (t) => {
    for (const content of [undefined, '', 'version: 2\nupdates: []', dependabot.replace('package-ecosystem: docker', 'package-ecosystem: pip')]) {
      const files = { ...clean };
      if (content === undefined) delete files['.github/dependabot.yml'];
      else files['.github/dependabot.yml'] = content;
      assert.deepEqual(codes(fixture(t, files, edition)), ['HFS_DEPENDABOT_MISSING']);
    }
  });

  test(`HFS_DEPENDABOT_MISSING accepts scheduled npm/action/docker updates (${edition})`, (t) => {
    assert.deepEqual(codes(fixture(t, clean, edition)), []);
  });

  test(`HFS_DEPENDABOT_MISSING rejects an npm update that lacks the group policy or admits majors (${edition})`, (t) => {
    for (const document of [
      dependabot.replace('update-types: [minor, patch]\n      security', 'update-types: [minor, patch, major]\n      security'),
      dependabot.replace('applies-to: security-updates', 'applies-to: version-updates'),
      dependabot.replace('      - dependency-name: "@starci/*"', '      - dependency-name: "left-pad"'),
      dependabot.replace(NPM_POLICY, ''),
    ]) assert.deepEqual(codes(fixture(t, { ...clean, '.github/dependabot.yml': document }, edition)), ['HFS_DEPENDABOT_MISSING']);
  });

  test(`HFS_DEPENDABOT_MISSING handles malformed update collections and directories (${edition})`, (t) => {
    for (const document of ['version: 2\nupdates: {}', 'version: 2\nupdates: invalid', dependabot.replaceAll('directory: /', 'directory: ""'), dependabot.replaceAll('directory: /', 'directories: [null]')]) assert.deepEqual(codes(fixture(t, { ...clean, '.github/dependabot.yml': document }, edition)), ['HFS_DEPENDABOT_MISSING']);
  });

  test(`HFS_AUDIT_STEP_MISSING rejects absent, commented, disabled or ignored production audit (${edition})`, (t) => {
    for (const step of ['      - run: npm ci --ignore-scripts', '      - run: echo npm audit --omit=dev', '      - run: npm audit --omit=dev\n        if: false', '      - run: npm audit --omit=dev\n        continue-on-error: true', '      - run: npm audit --omit=dev || true', '      - run: npm audit', '      - run: |\n          # npm audit --omit=dev\n          npm ci --ignore-scripts']) {
      assert.deepEqual(codes(fixture(t, { ...clean, '.github/workflows/ci.yml': workflow(step) }, edition)), ['HFS_AUDIT_STEP_MISSING']);
    }
    const files = { ...clean };
    delete files['.github/workflows/ci.yml'];
    assert.deepEqual(codes(fixture(t, files, edition)), ['HFS_AUDIT_STEP_MISSING']);
  });

  test(`HFS_AUDIT_STEP_MISSING accepts production audit including folded shell lines (${edition})`, (t) => {
    for (const step of ['      - run: npm audit --omit=dev --audit-level=high', '      - run: |\n          cd be && npm audit --omit dev', '      - run: |\n          npm audit \\\n            --omit=dev']) assert.deepEqual(codes(fixture(t, { ...clean, '.github/workflows/ci.yml': workflow(step) }, edition)), []);
  });

  test(`HFS_AUDIT_STEP_MISSING preserves quoted arguments and quoted separators (${edition})`, (t) => {
    for (const run of ["'npm' 'audit' '--omit=dev'", "echo 'quoted ; # &&'; npm audit --omit=dev", 'echo "quoted ; # ||" && npm audit --omit=dev', String.raw`echo \#; npm audit --omit=dev`]) {
      assert.deepEqual(codes(fixture(t, { ...clean, '.github/workflows/ci.yml': workflow(`      - run: |\n          ${run}`) }, edition)), []);
    }
  });

  test(`HFS_AUDIT_STEP_MISSING rejects swallowed, unreachable and textual commands (${edition})`, (t) => {
    for (const run of ['npm audit --omit=dev || :', 'npm audit --omit=dev || echo ignored', 'false && npm audit --omit=dev', 'echo ok # ; npm audit --omit=dev', 'echo "npm audit --omit=dev"', 'npm audit --omit=dev; exit 0', 'cat <<EOF\n          npm audit --omit=dev\n          EOF']) assert.deepEqual(codes(fixture(t, { ...clean, '.github/workflows/ci.yml': workflow(`      - run: |\n          ${run}`) }, edition)), ['HFS_AUDIT_STEP_MISSING']);
  });

  test(`HFS_SBOM_MISSING rejects missing SBOM or provenance and disabled build steps (${edition})`, (t) => {
    for (const step of [`      - uses: docker/build-push-action@${sha}`, `      - uses: docker/build-push-action@${sha}\n        with:\n          sbom: true`, `      - uses: docker/build-push-action@${sha}\n        with:\n          provenance: true`, `      - uses: docker/build-push-action@${sha}\n        if: false\n        with:\n          sbom: true\n          provenance: true`, '      - run: echo docker buildx build --sbom=true --provenance=true']) assert.deepEqual(codes(fixture(t, { ...clean, '.github/workflows/images.yml': workflow(step) }, edition)), ['HFS_SBOM_MISSING']);
    const files = { ...clean };
    delete files['.github/workflows/images.yml'];
    assert.deepEqual(codes(fixture(t, files, edition)), ['HFS_SBOM_MISSING']);
  });

  test(`HFS_SBOM_MISSING accepts image build attestations and separate SBOM/provenance actions (${edition})`, (t) => {
    for (const step of [`      - uses: docker/build-push-action@${sha}\n        with:\n          sbom: true\n          provenance: true`, '      - run: docker buildx build --sbom=true --provenance=mode=max .', `      - run: syft app:1.0.0 -o spdx-json=sbom.json\n      - uses: actions/attest-build-provenance@${sha}\n        with:\n          subject-digest: sha256:${'b'.repeat(64)}`]) assert.deepEqual(codes(fixture(t, { ...clean, '.github/workflows/images.yml': workflow(step) }, edition)), []);
  });

  test(`HFS_SBOM_MISSING preserves command and action attestation forms (${edition})`, (t) => {
    const steps = [
      '      - run: docker buildx build --sbom --provenance .',
      '      - run: docker buildx build --attest=type=sbom --attest=type=provenance,mode=max .',
      '      - run: docker buildx build --attest type=sbom,mode=min --attest type=provenance .',
      `      - run: docker sbom app:1.0.0\n      - uses: actions/attest-build-provenance@${sha}\n        with:\n          subject-path: image.tar`,
      `      - uses: actions/attest-sbom@${sha}\n        with:\n          sbom-path: sbom.json\n      - uses: actions/attest-build-provenance@${sha}\n        with:\n          subject-path: image.tar`,
    ];
    for (const step of steps) assert.deepEqual(codes(fixture(t, { ...clean, '.github/workflows/images.yml': workflow(step) }, edition)), []);
  });

  test(`HFS_SBOM_MISSING rejects commented or echoed flags and non-generating tools (${edition})`, (t) => {
    const commands = ['docker buildx build . # --sbom=true --provenance=true', 'docker buildx build .\n          echo --sbom=true --provenance=true', 'false && docker buildx build --sbom=true --provenance=true .', 'syft --help\n          docker buildx build --provenance=true .', 'syft --version\n          docker buildx build --provenance=true .', 'docker buildx build --attest=type=sbom-other --provenance=true .', 'docker buildx build --sbom=true --attest type=provenance-other .'];
    for (const run of commands) assert.deepEqual(codes(fixture(t, { ...clean, '.github/workflows/images.yml': workflow(`      - run: |\n          ${run}`) }, edition)), ['HFS_SBOM_MISSING']);
    assert.deepEqual(codes(fixture(t, { ...clean, '.github/workflows/images.yml': workflow(`      - uses: docker/build-push-action@${sha}\n        with:\n          sbom: mode=max\n          provenance: true`) }, edition)), ['HFS_SBOM_MISSING']);
  });

  test(`R269 wiring reports each missing supply-chain gate once through app check (${edition})`, (t) => {
    const ctx = fixture(t, {}, edition);
    const declaration = { hfs: 3, kind: 'app', project: 'demo', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } };
    const report = checkRepo({ repoRoot: ctx.repoRoot, declaration, files: [], tree: false });
    const hits = report.findings.filter((finding) => /HFS_(?:DEPENDABOT|AUDIT_STEP|SBOM)_MISSING/.test(finding.code));
    assert.deepEqual(hits.map((finding) => finding.code).sort((left, right) => left.localeCompare(right)), ['HFS_AUDIT_STEP_MISSING', 'HFS_DEPENDABOT_MISSING', 'HFS_SBOM_MISSING']);
    assert.ok(hits.every((finding) => finding.level === 'error' && finding.titleVi.length > 0));
    assert.ok(hits.every((finding) => ALL_CHECK_CODES.includes(finding.code)), 'supply-chain findings retain bundled catalog explanations');
  });
}

test('R269 honors path scope and skips runtime/side/unknown editions', (t) => {
  assert.deepEqual(codes(fixture(t, {}, 'lite', { inScope: (file) => file === '.github/workflows/ci.yml' })), ['HFS_AUDIT_STEP_MISSING']);
  for (const extra of [{ repo: { kind: 'runtime', edition: 'lite' } }, { isRoot: false }, { repo: { kind: 'app', edition: 'unknown' } }]) assert.deepEqual(codes(fixture(t, {}, 'full', extra)), []);
});

test('R269 uses the tracked inventory; files on disk alone cannot satisfy gates', (t) => {
  const ctx = fixture(t, clean, 'lite', { files: [] });
  assert.equal(supplyChainFindings(ctx).length, 3);
});
