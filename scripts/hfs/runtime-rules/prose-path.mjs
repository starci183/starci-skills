// prose-path.mjs - RT_PROSE_PATH_NO_SLOT (knowledge/hfs/rules.yaml, gate runtime): every product path the knowledge and the docs
// name (`be/...`, `fe/...`, written whole or with `<placeholder>`, `*` and `{a,b}`) resolves against knowledge/hfs/slots.yaml:
// the path is owned by a slot, or it is a folder above one (a prefix of a slot path). A path no slot owns is prose that invented
// a place, or a place a slot no longer has. App names are free: a literal name must be an app the shipped examples declare (the starter's
// apps are declared by them; the runtime never imports the scaffold of packages/hfs, which the runtime package does not ship);
// a placeholder stands for any app; a `**` glob is a file set, not a path. Paths that name a file of the knowledge itself (`be/folder.yaml`, a topic of
// knowledge/patterns/be) are topics, not product paths. Pure apart from ctx.read.
import { braceVariants } from '../../lib/glob.mjs';
import { replacePlaceholders, trimTrailingChars } from '../linear-text.mjs';
import { createSlotResolver, loadSlotManifest, resolveRepoDeclaration } from '../slots.mjs';
import { trimTrailingSlashes } from '../trailing-slashes.mjs';

export const CODE = 'RT_PROSE_PATH_NO_SLOT';
const KNOWLEDGE_PROSE = String.raw`knowledge\/(?!grammars\/|hfs\/slots\.yaml$|hfs\/runtime-slots\.yaml$|hfs\/canon-pins\.yaml$).+\.(?:ya?ml|md)`;
const DOC_PROSE = String.raw`docs\/.+\.md`;
const README_PROSE = String.raw`(?:.+\/)?README\.md`;
const PROSE = new RegExp(`^(?:${KNOWLEDGE_PROSE}|${DOC_PROSE}|${README_PROSE})$`);
const TOKEN_BOUNDARY = String.raw`(?<![\w/.<>-])`;
const TOKEN_ROOT = '((?:be|fe)/';
const TOKEN_SEGMENT = String.raw`[\w<>{}.,*@-]+`;
const TOKEN_CHILDREN = String.raw`(?:/[\w<>{}.,*@-]*)*)`;
const TOKEN = new RegExp(`${TOKEN_BOUNDARY}${TOKEN_ROOT}${TOKEN_SEGMENT}${TOKEN_CHILDREN}`, 'g');
const TOPIC_FILE = /\.(?:ya?ml|md)$/;
const PUNCTUATION = '.,;:)';
const FOLDERS_BELOW = ['x.ts', 'index.ts', 'main.ts', 'x/index.ts', 'x/x.ts', 'x/x/x.ts', 'x/src/main.ts', 'package.json'];

/** The declaration the prose is judged against: every app the examples declare, every kind, every optional slot. */
function proseDeclaration(manifest, examples) {
  const apps = (side) => [...new Map(examples.flatMap((d) => d.sides?.[side]?.apps ?? []).map((a) => [a.name, a])).values()];
  const union = (key, side) => [...new Set(examples.flatMap((d) => d.sides?.[side]?.[key] ?? []))];
  const first = examples[0];
  return {
    ...first,
    sides: {
      be: { ...first.sides.be, apps: apps('be'), kinds: union('kinds', 'be'), patterns: union('patterns', 'be'), optionalSlots: union('optionalSlots', 'be') },
      fe: { ...first.sides.fe, apps: apps('fe'), optionalSlots: union('optionalSlots', 'fe') },
    },
  };
}

const PLACEHOLDER = '<[^>]+>';
const BE_APP_PLACEHOLDER = new RegExp(`^(be/apps/)${PLACEHOLDER}`);
const FE_APP_PLACEHOLDER = new RegExp(`^(fe/apps/)${PLACEHOLDER}`);
const STAR_RUN = /\*+/g;

export const sample = (token) => replacePlaceholders(token
  .replace(BE_APP_PLACEHOLDER, '$1identity').replace(FE_APP_PLACEHOLDER, '$1app'), 'x').replace(STAR_RUN, 'x');

const segmentMatches = (a, b) => a === b || a === 'x' || b === 'x' || /[<*]/.test(b);

/** Whether `segments` is a folder above (or equal to) a slot path: every segment matches the slot's, placeholders matching anything. */
const aboveSlot = (segments, slotPaths) => slotPaths.some((slot) => segments.length <= slot.length && segments.every((segment, i) => segmentMatches(segment, slot[i])));

/** The tokens of one line: [{token, paths}] with braces expanded. */
export function pathTokens(line) {
  const out = [];
  for (const match of line.matchAll(TOKEN)) {
    const token = trimTrailingChars(match[1], PUNCTUATION);
    if (token.includes('...') || token.includes('**')) continue;
    out.push({ token, paths: braceVariants(token).map((variant) => trimTrailingSlashes(sample(variant))).filter((p) => /\/./.test(p) && !TOPIC_FILE.test(p)) });
  }
  return out;
}

/** The resolver of the prose: { owned(path) } — the path is owned by a slot or is a folder above one; null without example apps. */
export function createProseResolver(ctx, manifest) {
  const examples = ctx.files.filter((f) => /^examples\/[^/]+\/hfs\.json$/.test(f)).map((f) => JSON.parse(ctx.read(f)));
  if (!examples.length) return null;
  const resolver = createSlotResolver(manifest, resolveRepoDeclaration(manifest, proseDeclaration(manifest, examples)));
  const slotPaths = resolver.slots().flatMap((slot) => slot.profiles.flatMap((profile) => braceVariants(slot.path).map((p) => ((['be', 'fe'].includes(profile) ? `${profile}/` : '') + p).split('/').filter(Boolean))));
  const appNames = new Set(examples.flatMap((d) => ['be', 'fe'].flatMap((side) => (d.sides?.[side]?.apps ?? []).map((a) => a.name))));
  const declaredApp = (p) => { const m = /^(?:be|fe)\/apps\/([^/]+)/.exec(p); return !m || m[1] === 'x' || appNames.has(m[1]); };
  const owned = (p) => declaredApp(p) && ([p, ...FOLDERS_BELOW.map((below) => `${p}/${below}`)].some((q) => resolver.classifyPath(q).status !== 'no-slot') || aboveSlot(p.split('/'), slotPaths));
  return { owned, classify: (p) => resolver.classifyPath(p), sample };
}

const unownedFinding = (file, index, token) => ({ code: CODE, level: 'error', path: file, line: index + 1, message: `${CODE} ${file}:${index + 1}: ${token} is owned by no slot of knowledge/hfs/slots.yaml; name the slot id instead, or use a <placeholder> or a declared example app` });

const lineFindings = (resolver, file, line, index) => pathTokens(line)
  .filter(({ paths }) => paths.some((p) => !resolver.owned(p)))
  .map(({ token }) => unownedFinding(file, index, token));

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
    text.split('\n').forEach((line, index) => { found.push(...lineFindings(resolver, file, line, index)); });
  }
  return found;
}
