#!/usr/bin/env node
// check-package-imports.mjs - PACKAGE_IMPORT_UNPACKED (part of `npm run check`).
//   runs in the check stage (self-check package-imports); --json prints the findings as JSON
//
// A published @starci package must carry every file its own code loads. For each JavaScript package below (its `npm pack --dry-run` file list, the bytes
// that would be published), every relative module the packed sources load is resolved and must itself be in the packed list: a static `import ... from`,
// an `import '...'`, a dynamic `import('...')`, a `require('...')` / `require.resolve('...')` of a module file, and a `new URL('<file>.yaml', import.meta.url)`
// data read (the reads the runtime-copy bundler follows). A target that is not packed, or that leaves the package folder, is a finding. A `new URL` of any
// other file is a computed path, not a load the package makes on its own (the runtime-root anchor `../package.json`; the cli's embedded-runtime fallback
// `import(new URL('../../hfs/src/main.mjs'))`, taken only when the published @starci/hfs dependency is absent), and is not followed. alpha.22: @starci/hfs
// 4.7.0 shipped `import('../coverage/cli.mjs')` while its `files` list lacked coverage/**, so `starci app coverage merge` failed in every app's CI.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings } from '../lib/check-scan.mjs';
import { packedFiles } from '../gates/canon-digest.mjs';

export const CODE = 'PACKAGE_IMPORT_UNPACKED';
/** The JavaScript-source packages (no build step: what is packed is what runs). */
const PACKAGES = Object.freeze(['packages/hfs', 'packages/cli', 'packages/jest-preset', 'packages/eslint/be', 'packages/eslint/fe', 'packages/stylelint', 'packages/prettier-config']);
const SOURCE = /\.(?:mjs|cjs|js)$/;
/** String-literal module loads (the specifier is captured). */
const MODULE_LOADS = [
  /\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]/g,
  /\bimport\s+['"](\.{1,2}\/[^'"]+)['"]/g,
  /\bimport\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g,
  /\brequire(?:\.resolve)?\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g,
];
/** A module file the package loads: an explicit extension (ESM requires one); generated app code in templates has none. */
const MODULE_FILE = /\.(?:mjs|cjs|js|json)$/;
/** The data files a package reads beside itself: new URL('<relative>.yaml', import.meta.url). */
const DATA_READ = /new URL\(\s*['"](\.{1,2}\/[^'"]+\.ya?ml)['"]\s*,\s*import\.meta\.url/g;
const posix = (value) => value.split(path.sep).join('/');

/** The code of a source with its comments blanked, so an example import in a comment is not read. */
const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((line) => (/^\s*\/\//.test(line) ? '' : line)).join('\n');

/** The relative specifiers `text` loads. */
function specifiersOf(text) {
  const code = codeOf(text);
  const modules = MODULE_LOADS.flatMap((pattern) => [...code.matchAll(pattern)].map((match) => match[1])).filter((specifier) => MODULE_FILE.test(specifier));
  const data = [...code.matchAll(DATA_READ)].map((match) => match[1]);
  return [...new Set([...modules, ...data])].filter((specifier) => !specifier.includes('${'));
}

/** The findings of one package folder: each packed source that loads an unpacked file. `list` replaces the npm pack read in a probe. */
function packageImportFindings(root, dir, list = packedFiles(path.join(root, dir))) {
  const packed = new Set(list);
  const findings = [];
  for (const file of list.filter((entry) => SOURCE.test(entry))) {
    let text;
    try { text = fs.readFileSync(path.join(root, dir, file), 'utf8'); } catch { continue; }
    for (const specifier of specifiersOf(text)) {
      const target = posix(path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)));
      if (target.startsWith('../')) findings.push({ code: CODE, path: `${dir}/${file}`, message: `${dir}/${file} loads ${specifier}, outside the package folder: the published package cannot reach it` });
      else if (!packed.has(target)) findings.push({ code: CODE, path: `${dir}/${file}`, message: `${dir}/${file} loads ${specifier} (${dir}/${target}), which npm pack does not include: add it to the package.json files list` });
    }
  }
  return findings;
}

/** The findings over every JavaScript package of the runtime at `root`. */
function checkPackageImports(root = skillRoot) {
  return PACKAGES.filter((dir) => fs.existsSync(path.join(root, dir, 'package.json'))).flatMap((dir) => packageImportFindings(root, dir));
}

if (isMain(import.meta.url)) process.exit(printFindings(checkPackageImports(), 'OK: every module the packed @starci packages load is packed with them.'));
