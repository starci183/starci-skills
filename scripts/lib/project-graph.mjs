// project-graph.mjs - the ONE project graph the lint canon shares: the architecture machine's module graph and slot manifest,
// built once per process for a repository and cached, so every file a lint rule visits looks itself up in it.
//
// Both @starci/eslint-canon-be and @starci/eslint-canon-fe ship a byte copy of this file (and of the machine it imports) in their
// runtime/ bundle (packages/hfs/scripts/sync-runtime.mjs). There is no second graph: `projectGraph` runs `checkArchitecture`
// (scripts/checks/architecture/index.mjs) with `surface: 'lint'`, which judges exactly the checks whose findings attach to a
// TypeScript file, and indexes the findings by repository-relative path. `hfs check` runs the other surface ('check') and never
// the lint one, so no rule has two enforcers.
//
// A graph that cannot be built (no tsconfig, unresolvable import, invalid declaration) is an error: a check that cannot run is
// never a pass, so `projectGraph` throws the machine's own message and the lint run stops.
import fs from 'node:fs';
import { checkArchitecture } from '../checks/architecture/index.mjs';
import { openHfs } from './hfs-slots.mjs';
import { posixPath } from './path-key.mjs';

const cache = new Map();

/**
 * The graph findings of the repository at `repoRoot`, built on the first call of the process and reused after.
 *
 * @param {{ repoRoot: string, runtimeRoot: string, injectedTypeScript?: object }} input - `runtimeRoot` holds the slot manifest copy; `injectedTypeScript` is for hermetic fixtures only.
 * @returns {{ byFile: Map<string, object[]>, files: number }} Findings of the lint surface keyed by repository-relative path.
 */
export function projectGraph({ repoRoot, runtimeRoot, injectedTypeScript }) {
  const key = fs.realpathSync(repoRoot);
  if (!cache.has(key)) {
    const report = checkArchitecture({ repositoryRoot: key, hfs: openHfs({ root: runtimeRoot, repoRoot: key }), injectedTypeScript, surface: 'lint' });
    if (report.errors.length) throw new Error(`the project graph of ${key} cannot be built: ${report.errors.map((e) => `${e.ruleId}: ${e.message}`).join('; ')}`);
    const byFile = new Map();
    for (const violation of report.violations) {
      const file = posixPath(violation.path ?? '');
      byFile.set(file, [...(byFile.get(file) ?? []), violation]);
    }
    cache.set(key, { byFile, files: report.files });
  }
  return cache.get(key);
}

/** Forget every built graph (fixtures that rewrite a repository between cases). */
export const resetProjectGraphs = () => cache.clear();
