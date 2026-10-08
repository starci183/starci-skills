// sonar-rules-scope.mjs - the files SonarCloud analyses, read from sonar-project.properties: the one owner of the scope.
// The `sonar-rules` self-check lints exactly this set, so a file the scan sees is a file the gate sees and the other way round.
// sonar.sources lists files and directories; sonar.inclusions keeps the matching ones; sonar.exclusions drops them.
import fs from 'node:fs';
import path from 'node:path';
import { globExpression } from '../lib/glob.mjs';
import { byCodeUnit, splitList } from '../lib/list.mjs';
import { readProperties } from '../lib/properties.mjs';
import { walkFiles } from '../lib/walk.mjs';

const PROPERTIES_FILE = 'sonar-project.properties';

/** The scope {sources, inclusions, exclusions} declared at `root`, or null when the checkout carries no properties file. */
export function readSonarScope(root) {
  const file = path.join(root, PROPERTIES_FILE);
  if (!fs.existsSync(file)) return null;
  const props = readProperties(file);
  return { sources: splitList(props['sonar.sources']), inclusions: splitList(props['sonar.inclusions']), exclusions: splitList(props['sonar.exclusions']) };
}

/** Whether the posix path `rel` is analysed under `scope` (it is assumed to sit below one of the sources). */
export function inScope(rel, scope) {
  const included = !scope.inclusions.length || scope.inclusions.some((glob) => globExpression(glob).test(rel));
  return included && !scope.exclusions.some((glob) => globExpression(glob).test(rel));
}

const underSource = (rel, source) => rel === source || rel.startsWith(`${source.replace(/\/$/, '')}/`);

/** Whether `rel` is analysed: below a declared source and neither left out by an inclusion nor dropped by an exclusion. */
export const analysed = (rel, scope) => scope.sources.some((source) => underSource(rel, source)) && inScope(rel, scope);

/** The analysed files under `root` as sorted posix paths. */
export function scopeFiles(root, scope = readSonarScope(root)) {
  if (!scope) return [];
  const found = new Set();
  for (const source of scope.sources) {
    const full = path.join(root, source);
    if (!fs.existsSync(full)) continue;
    const files = fs.statSync(full).isDirectory()
      ? walkFiles(full, { exclude: (name) => name === 'node_modules' || name === '.git' })
      : [full];
    for (const file of files) found.add(path.relative(root, file).split(path.sep).join('/'));
  }
  return [...found].filter((rel) => inScope(rel, scope)).sort(byCodeUnit);
}
