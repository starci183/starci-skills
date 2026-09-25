// framework-pinned.mjs - the Next.js files that only load from a source root (the directory holding
// app/), and the export names the framework mandates in them. Authored once in
// knowledge/patterns/fe/folder.yaml FE-FOLDER-1 (frameworkPinnedRootFiles, frameworkPinnedRootExports),
// never hard-coded here (supervisor rulings, nivo wf-nivo-fe-debt-mug06w7h inc-2e42a24b74e4 and
// inc-846867b9a34e). Read by the architecture check (FE_SOURCE_LAYOUT_INVALID,
// FE_FRAMEWORK_ADAPTER_IMPORT) and the Next name-shape check (FE_SOURCE_NAME_SHAPE).
//
// An unreadable or malformed list is a broken install, not "no pinned files": both readers throw
// ARCH_KNOWLEDGE_UNAVAILABLE so the caller reports an error instead of judging with a different contract.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../../engine/yaml.mjs';

export const FRAMEWORK_PINNED_KNOWLEDGE = fileURLToPath(new URL('../../../knowledge/patterns/fe/folder.yaml', import.meta.url));

const cache = new Map(); // only the installed knowledge file is cached; an explicit file is re-read
const EXACT_NAME = /^[^\\/*?[\]{}\s]+$/;

function unavailable(file, detail) {
  return Error(`ARCH_KNOWLEDGE_UNAVAILABLE: ${file} ${detail}`);
}

/** The file stem Next.js keys a pinned file by: `middleware.ts` -> `middleware`, `next-env.d.ts` -> `next-env`. */
export function pinnedStem(fileName) {
  return path.basename(fileName).replace(/(?:\.d)?\.[cm]?[jt]sx?$/i, '');
}

function load(file) {
  if (cache.has(file)) return cache.get(file);
  let rule;
  try {
    rule = parseYaml(fs.readFileSync(file, 'utf8'))?.rules?.find(item => item?.id === 'FE-FOLDER-1');
  } catch (error) {
    throw unavailable(file, `cannot be read (${error.message ?? error}).`);
  }
  const list = rule?.frameworkPinnedRootFiles;
  if (!Array.isArray(list) || !list.length || list.some(name => typeof name !== 'string' || !EXACT_NAME.test(name))) {
    throw unavailable(file, 'FE-FOLDER-1 frameworkPinnedRootFiles must be a nonempty list of exact file names.');
  }
  const files = new Set(list);
  const stems = new Set(list.map(pinnedStem));
  const declared = rule.frameworkPinnedRootExports;
  if (!declared || typeof declared !== 'object' || Array.isArray(declared)) {
    throw unavailable(file, 'FE-FOLDER-1 frameworkPinnedRootExports must map a pinned file stem to its framework-mandated export names.');
  }
  const exports = new Map();
  for (const [stem, names] of Object.entries(declared)) {
    if (!stems.has(stem)) throw unavailable(file, `FE-FOLDER-1 frameworkPinnedRootExports names ${stem}, which no frameworkPinnedRootFiles entry pins.`);
    if (!Array.isArray(names) || !names.length || names.some(name => typeof name !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(name))) {
      throw unavailable(file, `FE-FOLDER-1 frameworkPinnedRootExports.${stem} must be a nonempty list of export identifiers.`);
    }
    exports.set(stem, new Set(names));
  }
  const loaded = { files, exports };
  if (file === FRAMEWORK_PINNED_KNOWLEDGE) cache.set(file, loaded);
  return loaded;
}

/** Exact basenames Next.js loads only from the source root. */
export function frameworkPinnedRootFiles(file = FRAMEWORK_PINNED_KNOWLEDGE) {
  return load(file).files;
}

/** Map of pinned file stem to the export names the framework mandates there. */
export function frameworkPinnedRootExports(file = FRAMEWORK_PINNED_KNOWLEDGE) {
  return load(file).exports;
}

/**
 * The framework-mandated export names for an absolute source file when it is a pinned file sitting
 * directly in a Next source root (its directory holds an app/ directory), else null.
 */
export function frameworkMandatedExports(absoluteFile, file = FRAMEWORK_PINNED_KNOWLEDGE) {
  const { files, exports } = load(file);
  if (!files.has(path.basename(absoluteFile))) return null;
  try {
    if (!fs.statSync(path.join(path.dirname(absoluteFile), 'app')).isDirectory()) return null;
  } catch {
    return null;
  }
  return exports.get(pinnedStem(absoluteFile)) ?? new Set();
}
