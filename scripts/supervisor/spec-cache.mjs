// spec-cache.mjs - the store of proven green spec runs: one small file per key under <runtime state dir>/spec-cache/. `starci test affected --run` reuses a spec whose key (spec-cache-key.mjs) holds a record here
// instead of running it again, and the receipt it leaves counts those files as `reused`. Only a PASS is recorded; a record is trusted only for the same key, node version and schema, so a change of any input, of
// node or of the runner preloads is a miss. The store lives beside the checkout it was proven in (.runtime/ is git-ignored and per clone); nothing is shared between checkouts or hosts.
import fs from 'node:fs';
import path from 'node:path';
import { runtimeStateDir } from '../../engine/runtime-root.mjs';
import { readJsonFile } from '../lib/json.mjs';

const CACHE_SCHEMA = 'starci/spec-cache@1';
const DAY_MS = 86_400_000;

/** Where the records of the checkout at `root` live. */
const specCacheDir = (root) => path.join(runtimeStateDir(root), 'spec-cache');

/**
 * The store of `root`. `keepDays` (modules/supervisor/affected-tests.yaml specCache.keepDays) bounds how long an unused record stays: `prune()` removes older ones.
 * `lookup(key)` -> the record of a proven green run at that key, or null; `record(key, {file, tier, ms})` files a green run.
 */
export function openSpecCache({ root, keepDays, nodeVersion = process.version, now = Date.now }) {
  const dir = specCacheDir(root);
  const fileOf = (key) => path.join(dir, `${key}.json`);
  return {
    lookup(key) {
      const record = readJsonFile(fileOf(key), null);
      return record?.schema === CACHE_SCHEMA && record.key === key && record.node === nodeVersion ? record : null;
    },
    record(key, { file, tier, ms }) {
      fs.mkdirSync(dir, { recursive: true });
      const target = fileOf(key);
      const tmp = `${target}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, `${JSON.stringify({ schema: CACHE_SCHEMA, key, file, tier, node: nodeVersion, at: now(), ms })}\n`);
      fs.renameSync(tmp, target);
    },
    prune() {
      let names = [];
      try { names = fs.readdirSync(dir); } catch { return 0; }
      const stale = names.filter((name) => name.endsWith('.json') && now() - fs.statSync(path.join(dir, name)).mtimeMs > keepDays * DAY_MS);
      for (const name of stale) fs.rmSync(path.join(dir, name), { force: true });
      return stale.length;
    },
  };
}
