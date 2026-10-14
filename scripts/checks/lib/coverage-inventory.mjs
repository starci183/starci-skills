// The coverage inventory comes from the existing catalogs and authored repository files.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../../engine/yaml.mjs';
import { walkFiles } from '../../lib/walk.mjs';
import { braceVariants, globExpression } from '../../lib/glob.mjs';
import { generatedRootsOf } from '../../lib/check-scan.mjs';
import { targetsOf } from '../../../packages/hfs/sync/index.mjs';
import { effectiveSlot, slotInEdition } from '../../hfs/edition-slots.mjs';

const TEMPLATE_ROOT = 'packages/hfs/templates/';
const TEXT_FILE = /\.(?:md|mjs|cjs|js|ts|tsx|jsx|yaml|yml|json|toml|sql|tpl|sh|css|properties|txt)$/;
// Custody files are deliberately excluded before opening any file, including sealed members.
export const coverageSafePath = (rel) => !/(?:^|\/)(?:node_modules|\.git|\.claude|\.aws|\.codex|\.agents|secrets?)(?:\/|$)/i.test(rel)
  && !/(?:^|\/)(?:secret\.env|secrets\.env|\.env(?:\.[^/]*)?|[^/]+\.enc|keys\.txt)$/i.test(rel);

export function coverageSources(root) {
  const generated = generatedRootsOf(root);
  const files = new Map();
  for (const dir of ['knowledge', 'modules/schemas', 'modules/kernel', 'docs', 'scripts', 'packages', 'examples', 'tests']) {
    const absolute = path.join(root, dir);
    if (!fs.existsSync(absolute)) continue;
    for (const file of walkFiles(absolute, { sorted: true, exclude: (_name, full, entry) => {
      const rel = path.relative(root, full).replaceAll('\\', '/');
      return entry.isSymbolicLink() || !coverageSafePath(rel) || generated.some((prefix) => `${rel}/`.startsWith(prefix))
        || /(?:^|\/)(?:runtime|dist|coverage|\.runtimes|artifacts)(?:\/|$)/.test(rel);
    } })) {
      const rel = path.relative(root, file).replaceAll('\\', '/');
      if (!TEXT_FILE.test(rel) && !/(?:^|\/)(?:Dockerfile|gitignore(?:-lite)?|starciwork\.gitignore(?:-lite)?|(?:pre-commit|pre-push)|(?:editorconfig|gitattributes|nvmrc|npmignore|prettierignore))$/.test(rel)) continue;
      files.set(rel, fs.readFileSync(file, 'utf8'));
    }
  }
  return files;
}

export const evidencePath = (ref) => typeof ref === 'string' ? ref : ref?.path;
export const evidenceInEdition = (ref, edition) => typeof ref === 'string'
  || (ref?.edition ? ref.edition === edition : !ref?.editions || ref.editions.includes(edition));

/** Resolve files, directories and globs; a missing path never counts as evidence. */
export function evidenceFiles(files, ref) {
  const name = String(evidencePath(ref) ?? '').split('#')[0].replace(/\/$/, '');
  if (!name) return [];
  if (files.has(name)) return [name];
  const expressions = braceVariants(name).map(globExpression);
  return [...files.keys()].filter((file) => file.startsWith(`${name}/`) || expressions.some((expression) => expression.test(file)));
}

export function exampleInventory(files) {
  const examples = [];
  // The index supplies references; hfs.json supplies the actual edition, never a guessed app name.
  const index = files.has('examples/index.yaml') ? parseYaml(files.get('examples/index.yaml')) : {};
  for (const [file, text] of files) {
    if (!/^examples\/[^/]+\/hfs\.json$/.test(file)) continue;
    const declaration = JSON.parse(text);
    const base = file.slice(0, -'/hfs.json'.length);
    examples.push({ path: base, edition: declaration.edition ?? 'full', declaration,
      files: [...files.keys()].filter((candidate) => candidate.startsWith(`${base}/`)),
      entries: (index?.examples ?? []).filter((entry) => `examples/${entry.path}` === base) });
  }
  return examples;
}

export function slotViews(manifest, edition) {
  return (manifest.slots ?? []).filter((slot) => slotInEdition(manifest, slot, edition)).flatMap((slot) =>
    (slot.profiles ?? ['app']).map((profile) => ({ original: slot, profile, slot: effectiveSlot(slot, profile, edition) }))
      .filter(({ slot }) => slot.presence !== 'forbidden'));
}

/** Use sync's own targetsOf calculation, including liteManagedBy and common template fallback. */
export function managedTemplates(context, edition) {
  const templates = new Map();
  const missing = [];
  for (const { original, profile } of slotViews(context.manifest, edition)) {
    if (original.managedBy === undefined && original.liteManagedBy === undefined) continue;
    try {
      const targets = targetsOf(profile, { edition, manifest: { ...context.manifest, slots: [original] },
        hasTemplate: (name) => context.files.has(`${TEMPLATE_ROOT}${name}`) });
      templates.set(original.id, targets.filter((target) => target.slot === original.id).map((target) => `${TEMPLATE_ROOT}${target.template}`));
    } catch (error) { missing.push({ slot: original.id, message: error.message }); }
  }
  return { templates, missing };
}

export const templateEvidence = (files, ref) => evidenceFiles(files, ref).filter((file) => file.startsWith(TEMPLATE_ROOT));

export function exampleEvidence(context, ref, edition) {
  const candidates = new Set(evidenceFiles(context.files, ref));
  return (context.examples ?? []).filter((example) => example.edition === edition)
    .flatMap((example) => example.files.filter((file) => candidates.has(file) && file !== `${example.path}/hfs.json`));
}
