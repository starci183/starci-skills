// prose-restates.mjs - RT_PROSE_RESTATES_SLOTS (knowledge/hfs/rules.yaml, gate runtime): knowledge and docs never restate
// knowledge/hfs/slots.yaml. A finding is
//   - a fenced block, or one line, that names three or more product paths slots.yaml owns (a path list or a tree), or
//   - one sentence that names three or more of the root or side file names the slots declare (`package.json`, `hfs.json`, ...).
// The only allowed form is a generated block between `<!-- hfs:generated ... -->` markers (scripts/hfs/readme-blocks.mjs); a slot is
// referenced by its id. Slots.yaml, runtime-slots.yaml, canon-pins and code examples are the sources or snapshots, not prose.
// Pure apart from ctx.read.
import { braceVariants } from '../../lib/glob.mjs';
import { loadSlotManifest } from '../slots.mjs';
import { createProseResolver, pathTokens } from './prose-path.mjs';

export const CODE = 'RT_PROSE_RESTATES_SLOTS';
const PATH_LIMIT = 3;
const PROSE = /^(?:knowledge\/(?!grammars\/|hfs\/slots\.yaml$|hfs\/runtime-slots\.yaml$|hfs\/canon-pins\.yaml$|hfs\/facts\.yaml$|hfs\/rules\.yaml$).+\.(?:ya?ml|md)|docs\/.+\.md|(?!examples\/|.+\/templates\/)(?:.+\/)?README\.md)$/;
const GENERATED = /<!-- hfs:generated (\S+) -->[\s\S]*?<!-- hfs:generated-end \1 -->/g;

/** The file names the slots of the app root and the sides declare as literal entries (no placeholder, no glob), as a Set. */
export function slotFileNames(manifest) {
  const names = new Set();
  for (const slot of manifest.slots) {
    for (const entry of [...braceVariants(slot.path), ...(slot.requires ?? [])]) {
      const name = String(entry).replace(/\/+$/, '').split('/').pop();
      if (/^[.\w-]+\.[\w.]+$|^\.[\w.-]+$/.test(name) && !/[<*]/.test(name)) names.add(name);
    }
  }
  return names;
}

/** The sentences of a text: a line is split at `. ` and `; `, so a list inside one sentence is counted once. */
const sentences = (line) => line.split(/(?<=[.;:])\s+/);

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
    if (!PROSE.test(file) || generated.some((root) => file.startsWith(root))) continue;
    const raw = ctx.read(file);
    if (raw === null || raw === undefined) continue;
    const text = raw.replace(GENERATED, (block) => block.replace(/[^\n]/g, ''));
    let fenceFrom = 0;
    let fenced = null;
    text.split('\n').forEach((line, index) => {
      const owned = (l) => new Set(pathTokens(l).flatMap(({ paths }) => paths.filter((p) => resolver.owned(p)))).size;
      if (/^\s*(?:- |# )?```/.test(line) || /^\s*```/.test(line)) {
        if (fenced === null) { fenced = new Set(); fenceFrom = index + 1; }
        else { if (fenced.size >= PATH_LIMIT) { add(file, fenceFrom, `a fenced block names ${fenced.size} slot paths`); } fenced = null; }
        return;
      }
      if (fenced !== null) {
        for (const { paths } of pathTokens(line)) {
          for (const p of paths) {
            if (resolver.owned(p)) fenced.add(p);
          }
        }
        return;
      }
      if (owned(line) >= PATH_LIMIT) add(file, index + 1, `one line names ${owned(line)} slot paths`);
      for (const sentence of sentences(line)) {
        const named = new Set([...sentence.matchAll(/`([^`\s]+)`/g)].map((m) => m[1].replace(/^\.?\//, '')).filter((n) => names.has(n)));
        if (named.size >= PATH_LIMIT) { add(file, index + 1, `one sentence lists ${named.size} root or side file names of the slots (${[...named].slice(0, 4).join(', ')})`); break; }
      }
    });
  }
  return found;
}
