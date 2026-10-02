import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'smol-toml';
import { scaffoldApp } from '../../packages/hfs/scaffold/app.mjs';
import { SUPABASE_PORT_VARIABLES, supabasePortBase, supabasePortVars } from '../../packages/hfs/scaffold/supabase-ports.mjs';
import { checkDatabase } from '../../scripts/hfs/rules/database.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const PINS = parseYaml(fs.readFileSync(path.join(ROOT, 'knowledge', 'hfs', 'canon-pins.yaml'), 'utf8')).pins;
// The Supabase CLI defaults, the range another local project of this host keeps for its own stack, and the Next dev port.
const TYPES = `export type Database = { public: { Tables: Record<string, never> } };
`;
const TAKEN = [[54320, 54329], [55321, 55327], [3100, 3100], [3000, 3000]];

test('a project name gets one stable block of ten ports clear of the CLI defaults and other local stacks', () => {
  assert.equal(supabasePortBase('demo'), supabasePortBase('demo'));
  for (const name of ['demo', 'booking', 'lite-app', 'a', 'a-very-long-project-name-for-a-lite-app']) {
    const ports = Object.values(supabasePortVars(name)).map(Number);
    assert.equal(new Set(ports).size, ports.length, `${name}: every section has its own port`);
    for (const port of ports) {
      assert.ok(port >= 41000 && port < 45000, `${name}: ${port} is inside the block range`);
      assert.equal(TAKEN.some(([from, to]) => port >= from && port <= to), false, `${name}: ${port} avoids the taken ports`);
    }
  }
  assert.deepEqual(Object.keys(supabasePortVars('demo')), [...SUPABASE_PORT_VARIABLES]);
});

test('the lite scaffold writes its own port block into supabase/config.toml and the database rules accept it', async (t) => {
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-supabase-ports-'));
  t.after(() => fs.rmSync(into, { recursive: true, force: true }));
  const { root, files } = scaffoldApp({
    name: 'demo', into, edition: 'lite', pins: PINS, lock: (root) => { fs.writeFileSync(path.join(root, 'package-lock.json'), '{}'+String.fromCharCode(10)); return { ok: true }; }, emitTypes: () => TYPES,
    now: () => new Date('2026-10-02T12:34:56.000Z'),
  });
  const config = parse(fs.readFileSync(path.join(root, 'supabase', 'config.toml'), 'utf8'));
  const vars = supabasePortVars('demo');
  assert.deepEqual(
    [config.api.port, config.db.port, config.db.shadow_port, config.db.pooler.port, config.studio.port, config.inbucket.port, config.analytics.port],
    [vars.supabasePortApi, vars.supabasePortDb, vars.supabasePortShadow, vars.supabasePortPooler, vars.supabasePortStudio, vars.supabasePortInbucket, vars.supabasePortAnalytics].map(Number),
  );
  assert.deepEqual(await checkDatabase({ repoRoot: root, files, emitTypes: async () => TYPES }), []);
});
