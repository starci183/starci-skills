// sonar-rules-scope.mjs - the files SonarCloud analyses, read from sonar-project.properties: the one owner of the scope.
// The `sonar-rules` self-check lints exactly this set, so a file the scan sees is a file the gate sees and the other way round.
// sonar.sources lists files and directories; sonar.inclusions keeps the matching ones; sonar.exclusions drops them.
import fs from 'node:fs';
import path from 'node:path';
import { byCodeUnit } from '../lib/list.mjs';
import { walkFiles } from '../lib/walk.mjs';

export const PROPERTIES_FILE = 'sonar-project.properties';

const list = (value) => (value ?? '').split(',').map((entry) => entry.trim()).filter(Boolean);

/** The `key=value` pairs of a properties text; blank lines and `#` comments are skipped. */
export function parseProperties(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    const at = trimmed.indexOf('=');
    if (!trimmed || trimmed.startsWith('#') || at < 1) continue;
    out[trimmed.slice(0, at).trim()] = trimmed.slice(at + 1).trim();
  }
  return out;
}

/** The scope {sources, inclusions, exclusions} declared at `root`, or null when the checkout carries no properties file. */
export function readSonarScope(root) {
  const file = path.join(root, PROPERTIES_FILE);
  if (!fs.existsSync(file)) return null;
  const props = parseProperties(fs.readFileSync(file, 'utf8'));
  return { sources: list(props['sonar.sources']), inclusions: list(props['sonar.inclusions']), exclusions: list(props['sonar.exclusions']) };
}

const GLOB_TOKENS = /\*\*\/|\/\*\*|\*\*|\*|\?|[.+^${}()|[\]\\]/g;
const GLOB_PARTS = Object.freeze({ '**/': '(?:.*/)?', '/**': '(?:/.*)?', '**': '.*', '*': '[^/]*', '?': '[^/]' });

/** The anchored regular expression of a Sonar glob (`**` crosses directories, `*` and `?` stay inside one). */
export const globRegex = (glob) => new RegExp(`^${glob.replaceAll(GLOB_TOKENS, (token) => GLOB_PARTS[token] ?? `\\${token}`)}$`);

/** Whether the posix path `rel` is analysed under `scope` (it is assumed to sit below one of the sources). */
export function inScope(rel, scope) {
  const included = !scope.inclusions.length || scope.inclusions.some((glob) => globRegex(glob).test(rel));
  return included && !scope.exclusions.some((glob) => globRegex(glob).test(rel));
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
