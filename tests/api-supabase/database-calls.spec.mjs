import assert from 'node:assert/strict';
import test from 'node:test';
import { databaseDump } from '../../scripts/api/supabase/database-dump.mjs';
import { databaseQuery } from '../../scripts/api/supabase/database-query.mjs';
import { migrationRepair } from '../../scripts/api/supabase/migration-repair.mjs';

for (const [name, call, prefix, args] of [
  ['database dump', databaseDump, ['db', 'dump'], ['--local']],
  ['database query', databaseQuery, ['db', 'query'], ['select 1', '--local', '--output', 'json']],
  ['migration repair', migrationRepair, ['migration', 'repair'], ['20261015000000', '--status', 'applied', '--local']],
]) {
  test(name + ' preserves its Supabase verb, arguments, private environment and spawn result', () => {
    const result = { status: 0, stdout: 'result', stderr: '' };
    const env = { PATH: '', SUPABASE_TELEMETRY_DISABLED: '1' };
    const actual = call('/fixture/app', args, { supabase: '/fixture/supabase', env, timeout: 321, run(binary, argv, options) {
      assert.equal(binary, '/fixture/supabase');
      assert.deepEqual(argv, [...prefix, ...args]);
      assert.deepEqual(options, { cwd: '/fixture/app', encoding: 'utf8', env, timeout: 321, windowsHide: true });
      return result;
    } });
    assert.equal(actual, result);
  });
}
