// prose-restates.mjs - RT_PROSE_RESTATES_SLOTS (knowledge/hfs/rules.yaml, gate runtime): knowledge and docs never restate
// knowledge/hfs/slots.yaml. A finding is
//   - a fenced block, or one line, that names three or more product paths slots.yaml owns (a path list or a tree), or
//   - one sentence that names three or more of the root or side file names the slots declare (`package.json`, `hfs.json`, ...).
// The only allowed form is a generated block between `<!-- hfs:generated ... -->` markers (scripts/hfs/readme-blocks.mjs); a slot is
// referenced by its id. Slots.yaml, runtime-slots.yaml, canon-pins and code examples are the sources or snapshots, not prose.
// Pure apart from ctx.read.
import { braceVariants } from '../../lib/glob.mjs';
import { trimTrailingSlashes } from '../trailing-slashes.mjs';
import { loadSlotManifest } from '../slots.mjs';
import { createProseResolver, pathTokens } from './prose-path.mjs';

export const CODE = 'RT_PROSE_RESTATES_SLOTS';
const PATH_LIMIT = 3;
const KNOWLEDGE_PROSE = /^knowledge\/.+\.(?:ya?ml|md)$/;
const KNOWLEDGE_SOURCES = ['knowledge/grammars/'];
const KNOWLEDGE_SNAPSHOTS = new Set(['slots.yaml', 'runtime-slots.yaml', 'canon-pins.yaml', 'facts.yaml', 'rules.yaml'].map((name) => `knowledge/hfs/${name}`));
const DOC_PROSE = /^docs\/.+\.md$/;
const README = 'README.md';
const NEWLINE = String.fromCodePoint(10);
const isKnowledgeProse = (file) => KNOWLEDGE_PROSE.test(file) && !KNOWLEDGE_SOURCES.some((prefix) => file.startsWith(prefix)) && !KNOWLEDGE_SNAPSHOTS.has(file);
/** A README of any folder except the examples and the templates folders. */
const isReadmeProse = (file) => (file === README || (file.length > README.length + 1 && file.endsWith(`/${README}`)))
  && !file.startsWith('examples/') && file.indexOf('/templates/') <= 0;
/** A path (one line, no newline) of the prose files the runtime judges: knowledge and docs files and READMEs. */
const isProseFile = (file) => !file.includes(NEWLINE) && (isKnowledgeProse(file) || DOC_PROSE.test(file) || isReadmeProse(file));
const GENERATED = /<!-- hfs:generated (\S+) -->[\s\S]*?<!-- hfs:generated-end \1 -->/g;
const FILE_NAME_CHARS = /^[.\w-]+$/;

/** True for `name.ext` (an extension of word characters and dots after a dot) or a dot file (`.gitignore`), written in word characters, dots and dashes. */
const isSlotFileName = (name) => {
  if (!FILE_NAME_CHARS.test(name)) return false;
  if (name.length >= 2 && name.startsWith('.')) return true;
  const dot = name.indexOf('.', Math.max(name.lastIndexOf('-') + 1, 1));
  return dot !== -1 && dot <= name.length - 2;
};

/** The file names the slots of the app root and the sides declare as literal entries (no placeholder, no glob), as a Set. */
export function slotFileNames(manifest) {
  const names = new Set();
  for (const slot of manifest.slots) {
    for (const entry of [...braceVariants(slot.path), ...(slot.requires ?? [])]) {
      const name = trimTrailingSlashes(String(entry)).split('/').pop();
      if (isSlotFileName(name) && !/[<*]/.test(name)) names.add(name);
    }
  }
  return names;
}

/** The sentences of a text: a line is split at `. ` and `; `, so a list inside one sentence is counted once. */
const sentences = (line) => line.split(/(?<=[.;:])\s+/);

const ownedPathCount = (line, resolver) => new Set(pathTokens(line).flatMap(({ paths }) => paths.filter((p) => resolver.owned(p)))).size;

function inspectFenceMarker(line, index, file, state, add) {
  if (!/^\s*(?:- |# )?```/.test(line) && !/^\s*```/.test(line)) return false;
  if (state.fenced === null) { state.fenced = new Set(); state.fenceFrom = index + 1; }
  else {
    if (state.fenced.size >= PATH_LIMIT) add(file, state.fenceFrom, `a fenced block names ${state.fenced.size} slot paths`);
    state.fenced = null;
  }
  return true;
}

function collectFencedPaths(line, fenced, resolver) {
  for (const { paths } of pathTokens(line)) {
    for (const p of paths) {
      if (resolver.owned(p)) fenced.add(p);
    }
  }
}

function addPathLineFinding(line, file, lineNumber, resolver, add) {
  if (ownedPathCount(line, resolver) >= PATH_LIMIT) add(file, lineNumber, `one line names ${ownedPathCount(line, resolver)} slot paths`);
}

function addFileNameSentenceFinding(line, file, lineNumber, names, add) {
  for (const sentence of sentences(line)) {
    const named = new Set([...sentence.matchAll(/`([^`\s]+)`/g)].map((m) => m[1].replace(/^\.?\//, '')).filter((n) => names.has(n)));
    if (named.size >= PATH_LIMIT) { add(file, lineNumber, `one sentence lists ${named.size} root or side file names of the slots (${[...named].slice(0, 4).join(', ')})`); break; }
  }
}

function inspectProseLines(text, file, resolver, names, add) {
  const state = { fenceFrom: 0, fenced: null };
  text.split('\n').forEach((line, index) => {
    if (inspectFenceMarker(line, index, file, state, add)) return;
    if (state.fenced !== null) {
      collectFencedPaths(line, state.fenced, resolver);
      return;
    }
    addPathLineFinding(line, file, index + 1, resolver, add);
    addFileNameSentenceFinding(line, file, index + 1, names, add);
  });
}

/** RT_PROSE_RESTATES_SLOTS over the prose files of the runtime (ctx of scripts/hfs/runtime-check.mjs). */
export function proseRestateFindings(ctx) {
  const manifest = loadSlotManifest({ root: ctx.root });
  const resolver = createProseResolver(ctx, manifest);
  if (!resolver) return [];
  const names = slotFileNames(manifest);
  const generated = (ctx.params.generated ?? []).map((entry) => `${entry.root}/`);
  const found = [];
  const add = (file, line, what) => found.push({ code: CODE, level: 'error', path: file, line, message: `${CODE} ${file}:${line}: ${what}; reference the slot ids of knowledge/hfs/slots.yaml (or a generated hfs:generated block) instead of restating them` });
  for (const file of ctx.files) {
    if (!isProseFile(file) || generated.some((root) => file.startsWith(root))) continue;
    const raw = ctx.read(file);
    if (raw === null || raw === undefined) continue;
    const text = raw.replace(GENERATED, (block) => block.replace(/[^\n]/g, ''));
    inspectProseLines(text, file, resolver, names, add);
  }
  return found;
}
