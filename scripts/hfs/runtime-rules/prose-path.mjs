// prose-path.mjs - RT_PROSE_PATH_NO_SLOT (knowledge/hfs/rules.yaml, gate runtime): every product path the knowledge and the docs
// name (`be/...`, `fe/...`, written whole or with `<placeholder>`, `*` and `{a,b}`) resolves against knowledge/hfs/slots.yaml:
// the path is owned by a slot, or it is a folder above one (a prefix of a slot path). A path no slot owns is prose that invented
// a place, or a place a slot no longer has. App names are free: a literal name must be an app the examples or the starter declare;
// a placeholder stands for any app; a `**` glob is a file set, not a path. Paths that name a file of the knowledge itself (`be/folder.yaml`, a topic of
// knowledge/patterns/be) are topics, not product paths. Pure apart from ctx.read.
import { STARTER_SIDES } from '../../../packages/hfs/scaffold/app.mjs';
import { braceVariants } from '../../lib/glob.mjs';
import { createSlotResolver, loadSlotManifest, resolveRepoDeclaration } from '../slots.mjs';

export const CODE = 'RT_PROSE_PATH_NO_SLOT';
const PROSE = /^(?:knowledge\/(?!code-examples\/|grammars\/|hfs\/slots\.yaml$|hfs\/runtime-slots\.yaml$|hfs\/canon-pins\.yaml$).+\.(?:ya?ml|md)|docs\/.+\.md|(?:.+\/)?README\.md)$/;
const TOKEN = /(?<![\w/.<>-])((?:be|fe)\/[\w<>{}.,*@-]+(?:\/[\w<>{}.,*@-]*)*)/g;
const TOPIC_FILE = /\.(?:ya?ml|md)$/;
const FOLDERS_BELOW = ['x.ts', 'index.ts', 'main.ts', 'x/index.ts', 'x/x.ts', 'x/x/x.ts', 'x/src/main.ts', 'package.json'];

/** The declaration the prose is judged against: every app the examples declare plus the starter's, every kind, every optional slot. */
export function proseDeclaration(manifest, examples, starter) {
  const apps = (side) => [...new Map([...examples, starter].flatMap((d) => d.sides?.[side]?.apps ?? []).map((a) => [a.name, a])).values()];
  const union = (key, side) => [...new Set([...examples, starter].flatMap((d) => d.sides?.[side]?.[key] ?? []))];
  const first = examples[0];
  return {
    ...first,
    sides: {
      be: { ...first.sides.be, apps: apps('be'), kinds: union('kinds', 'be'), patterns: union('patterns', 'be'), optionalSlots: union('optionalSlots', 'be') },
      fe: { ...first.sides.fe, apps: apps('fe'), optionalSlots: union('optionalSlots', 'fe') },
    },
  };
}

export const sample = (token) => token
  .replace(/^(be\/apps\/)<[^>]+>/, '$1identity').replace(/^(fe\/apps\/)<[^>]+>/, '$1app')
  .replace(/<[^>]+>/g, 'x').replace(/\*+/g, 'x');

const segmentMatches = (a, b) => a === b || a === 'x' || b === 'x' || /[<*]/.test(b);

/** Whether `segments` is a folder above (or equal to) a slot path: every segment matches the slot's, placeholders matching anything. */
const aboveSlot = (segments, slotPaths) => slotPaths.some((slot) => segments.length <= slot.length && segments.every((segment, i) => segmentMatches(segment, slot[i])));

/** The tokens of one line: [{token, paths}] with braces expanded. */
export function pathTokens(line) {
  const out = [];
  for (const match of line.matchAll(TOKEN)) {
    const token = match[1].replace(/[.,;:)]+$/, '');
    if (token.includes('...') || token.includes('**')) continue;
    out.push({ token, paths: braceVariants(token).map((variant) => sample(variant).replace(/\/+$/, '')).filter((p) => /\/./.test(p) && !TOPIC_FILE.test(p)) });
  }
  return out;
}

/** The resolver of the prose: { owned(path) } — the path is owned by a slot or is a folder above one; null without example apps. */
export function createProseResolver(ctx, manifest) {
  const examples = ctx.files.filter((f) => /^examples\/[^/]+\/hfs\.json$/.test(f)).map((f) => JSON.parse(ctx.read(f)));
  if (!examples.length) return null;
  const resolver = createSlotResolver(manifest, resolveRepoDeclaration(manifest, proseDeclaration(manifest, examples, { sides: STARTER_SIDES })));
  const slotPaths = resolver.slots().flatMap((slot) => slot.profiles.flatMap((profile) => braceVariants(slot.path).map((p) => `${['be', 'fe'].includes(profile) ? `${profile}/` : ''}${p}`.split('/').filter(Boolean))));
  const appNames = new Set([...examples, { sides: STARTER_SIDES }].flatMap((d) => ['be', 'fe'].flatMap((side) => (d.sides?.[side]?.apps ?? []).map((a) => a.name))));
  const declaredApp = (p) => { const m = /^(?:be|fe)\/apps\/([^/]+)/.exec(p); return !m || m[1] === 'x' || appNames.has(m[1]); };
  const owned = (p) => declaredApp(p) && ([p, ...FOLDERS_BELOW.map((below) => `${p}/${below}`)].some((q) => resolver.classifyPath(q).status !== 'no-slot') || aboveSlot(p.split('/'), slotPaths));
  return { owned };
}

/** RT_PROSE_PATH_NO_SLOT over the prose files of the runtime (ctx of scripts/hfs/runtime-check.mjs). */
export function prosePathFindings(ctx) {
  const resolver = createProseResolver(ctx, loadSlotManifest({ root: ctx.root }));
  if (!resolver) return [];
  const generated = (ctx.params.generated ?? []).map((entry) => `${entry.root}/`);
  const found = [];
  for (const file of ctx.files) {
    if (!PROSE.test(file) || generated.some((root) => file.startsWith(root))) continue;
    const text = ctx.read(file);
    if (text === null || text === undefined) continue;
    text.split('\n').forEach((line, index) => {
      for (const { token, paths } of pathTokens(line)) {
        if (paths.some((p) => !resolver.owned(p))) found.push({ code: CODE, level: 'error', path: file, line: index + 1, message: `${CODE} ${file}:${index + 1}: ${token} is owned by no slot of knowledge/hfs/slots.yaml; name the slot id instead, or use a <placeholder> or a declared example app` });
      }
    });
  }
  return found;
}
