// spec-cache-key.mjs - the cache key of one spec file: a hash of EVERYTHING its last green run could have depended on, so an unchanged key means the same inputs and a changed one a re-run.
// Inputs, by class (each is flipped by a spec in tests/supervisor/spec-cache-key.spec.mjs):
//   the spec file itself and its import closure (static, re-export, literal dynamic import and require, a runtime entry it spawns: spec-deps.mjs reachableFrom)
//   the data its modules name (spec-cache-reads.mjs: files, sibling folders, named folders, named trees) and the generated outputs of a generator in the closure
//   the tier tree the closure's markers ask for (spec-cache-markers.mjs): every runtime file for a spec that starts the CLI, every file for one that scans tests/docs/examples
//   the runner: node version, platform and architecture, the content of the preload files and their imports, the root manifest and lockfiles (the dependency versions)
// A key never says a spec passed; the store (spec-cache.mjs) holds only keys of green runs.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { byCodeUnit } from '../lib/list.mjs';
import { reachableFrom } from '../lib/spec-deps.mjs';
import { fileIndex, readsOf } from './spec-cache-reads.mjs';
import { TIERS, tierOfText, widest } from './spec-cache-markers.mjs';
import { ignoredFileId, treeIds } from './spec-cache-tree.mjs';

const VERSION = 'spec-cache-key@1';
const MANIFESTS = ['package.json', 'package-lock.json', 'packages/package-lock.json'];
const OUTSIDE_RUNTIME = /^(?:tests|examples|benchmark)\//;
const sha = (lines) => crypto.createHash('sha256').update(lines.join('\n')).digest('hex');
const readText = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } };

/**
 * A keyer over the checkout `root`: `keyOf(spec)` = {key, tier, closure, reads}. `preloads` = the runner's preload files (repository-relative), `generated` = [{output, generator}] of
 * modules/supervisor/affected-tests.yaml, `ids` the tree listing (spec-cache-tree.mjs treeIds; read once here by default).
 */
export function createKeyer({ root, preloads, generated = [], ids = treeIds(root), nodeVersion = process.version }) {
  const index = fileIndex([...ids.keys()]);
  const graph = new Map();
  const facts = new Map();
  const treeDigests = new Map();
  const idOf = (rel) => ids.get(rel) ?? ignoredFileId(root, rel) ?? 'absent';
  const lines = (rels) => [...new Set(rels)].sort(byCodeUnit).map((rel) => `${rel}=${idOf(rel)}`);

  const factsOf = (rel) => {
    if (!facts.has(rel)) {
      const text = readText(path.join(root, rel));
      facts.set(rel, { tier: tierOfText(text), reads: readsOf({ file: rel, text, index }) });
    }
    return facts.get(rel);
  };
  const generatedOf = (closure) => generated.filter((entry) => closure.has(entry.generator))
    .flatMap((entry) => (entry.output.endsWith('/') ? index.under(entry.output.slice(0, -1)) : [entry.output]));
  const treeDigest = (tier) => {
    if (!treeDigests.has(tier)) treeDigests.set(tier, sha(lines([...ids.keys()].filter((rel) => tier === TIERS.tree || !OUTSIDE_RUNTIME.test(rel)))));
    return treeDigests.get(tier);
  };
  const runnerLines = () => [VERSION, nodeVersion, `${process.platform}-${process.arch}`, ...lines(MANIFESTS.filter((rel) => ids.has(rel))),
    ...lines(preloads.flatMap((preload) => [...reachableFrom(root, preload, { cache: graph })]))];
  const runner = sha(runnerLines());

  return {
    keyOf(spec) {
      const closure = reachableFrom(root, spec, { cache: graph });
      const own = [...closure].map(factsOf);
      const reads = own.flatMap((entry) => entry.reads);
      const tier = widest(own.map((entry) => entry.tier));
      const parts = [runner, spec, ...lines([...closure]), ...lines([...reads, ...generatedOf(closure)]), ...(tier === TIERS.narrow ? [] : [`tier ${tier}`, treeDigest(tier)])];
      return { key: sha(parts), tier, closure: closure.size, reads: new Set(reads).size };
    },
  };
}
