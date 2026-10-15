// proves: HFS_TOOL_CONFIG_LOCAL@lite
// proves: HFS_TOOL_CONFIG_LOCAL@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { renderTargets } from '../../packages/hfs/sync/index.mjs';
import { APP, PRESETS } from '../helpers/hfs-cli-fixture.mjs';

const CODE = 'HFS_TOOL_CONFIG_LOCAL';

for (const edition of ['lite', 'full']) {
  for (const side of ['be', 'fe']) {
    test(`${edition}: ${side} rejects a forbidden tool config and accepts the factory filename`, (context) => {
      const temporaryRoot = path.resolve(os.tmpdir());
      const repoRoot = fs.mkdtempSync(path.join(temporaryRoot, 'hfs-proof-forbidden-config-'));
      assert.equal(path.dirname(repoRoot), temporaryRoot);
      context.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
      const declaration = structuredClone(APP);
      declaration.edition = edition;
      if (edition === 'lite') declaration.sides.be.connections = [
        { name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' },
      ];
      const canonical = `${side}/eslint.config.mjs`;
      const rendered = renderTargets(declaration, PRESETS).find((target) => target.path === canonical);
      assert.ok(rendered, 'the managed factory configuration is rendered');
      fs.mkdirSync(path.join(repoRoot, side));
      fs.writeFileSync(path.join(repoRoot, canonical), rendered.content);
      const passing = checkRepo({ repoRoot, declaration, files: [canonical] });
      assert.deepEqual(passing.findings.filter((finding) => finding.code === CODE), []);

      const forbidden = `${side}/.eslintrc.json`;
      fs.writeFileSync(path.join(repoRoot, forbidden), '{}\n');
      const violating = checkRepo({ repoRoot, declaration, files: [canonical, forbidden] });
      assert.deepEqual(violating.findings.filter((finding) => finding.code === CODE)
        .map((finding) => [finding.code, finding.path, finding.level]), [[CODE, forbidden, 'error']]);

      fs.unlinkSync(path.join(repoRoot, forbidden));
      const restored = checkRepo({ repoRoot, declaration, files: [canonical] });
      assert.deepEqual(restored.findings.filter((finding) => finding.code === CODE), []);
    });
  }
}
