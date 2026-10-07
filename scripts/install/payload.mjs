// payload.mjs - the install owner's current file selection, custody hashing and copying.
// Lifecycle/protocol/bootstrap decisions remain in install.mjs; these operations share package.files
// and the existing catalog/stack exclusions without a second descriptor or source baseline.
import {cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, lstatSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isLinkLike} from '../api/fs/is-link-like.mjs';
import {globExpression} from '../lib/glob.mjs';
import {EXAMPLE_CATALOG_FILE, EXAMPLES_ROOT, discoverExampleApps, exampleSourcePaths} from '../lib/example-refs.mjs';
import {installedPayloadDigest} from '../lib/install-custody.mjs';
import {byCodeUnit} from '../lib/list.mjs';
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

// What an installed tree is made of. Only these paths are copied, hashed and updated; anything else
// a person adds beside them (other tests, notes) is theirs and is never touched. The payload equals
// the npm `files` allowlist — the installed tree must be byte-identical to the published tarball —
// so `!` negations are compiled into the walker and root globs like `*.md` expand to real files.
const rootGlob = (entry) => {
  const m = /^\*\.([A-Za-z0-9]+)$/.exec(entry);
  if (!m) throw new Error(`unsupported files glob in package.json: ${entry}`);
  return readdirSync(packageRoot, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith(`.${m[1]}`)).map((e) => e.name);
};
// One shared glob matcher interprets the manifest's directory and capture-file exclusions.
const SLASH = '/';
const END = '$';
const TRAILING_SLASHES = new RegExp(`${SLASH}+${END}`);
const PAYLOAD_NEGATIONS = pkg.files.filter((f) => f.startsWith('!')).flatMap((f) => {
  const pattern = f.slice(1).replace(TRAILING_SLASHES, '');
  return [globExpression(pattern), ...(f.endsWith('/') ? [globExpression(`${pattern}/**`)] : [])];
});
// npm treats existing literal files as strict inclusions; directory/glob negations still prune siblings.
const EXAMPLE_FILE_INCLUSIONS = new Set(pkg.files.filter(entry => entry.startsWith(`${EXAMPLES_ROOT}/`)
  && !entry.endsWith('/') && !entry.includes('*')));
export const isNegated = (relative) => !EXAMPLE_FILE_INCLUSIONS.has(relative) && PAYLOAD_NEGATIONS.some((rx) => rx.test(relative));
export const PAYLOAD = [...new Set(['package.json', ...pkg.files.filter((f) => !f.startsWith('!')).flatMap((f) => f.includes('*') ? rootGlob(f) : [f.replace(/\/$/, '')])])];
// `docs/` and `examples/` ship only authored reference files. An `examples/<app>/` stack kit (the app root's
// `.starcistacks/` tree plus the app's `scripts/`, `gateway/`
// and `.gitignore` support files) additionally ships shell/config/Dockerfile inputs — but never
// materialized runtime or generated output, never a plaintext secret beside its sealed `.enc`
// counterpart, and never a `.mjs` automation source.
const stackKitPath = (relative) => /^examples\/[^/]+\/(\.starcistacks(\/|$)|scripts\/|gateway\/|\.gitignore$)/.test(relative);
const payloadDocAllowed = (root, relative, exampleInputs) => {
  if (EXAMPLE_FILE_INCLUSIONS.has(relative)) return true;
  if (stackKitPath(relative)) {
    if (/\/(runtime|generated|\.runtime|node_modules|\.scannerwork)(\/|$)/.test(relative)) return false;
    const absolute = path.join(root, relative);
    if (!relative.endsWith('.enc') && existsSync(absolute + '.enc')) return false;
    if (relative.endsWith('.mjs')) return false;
    return /\.(md|ya?ml|tsx?|png|svg|sh|ps1|conf)$/.test(relative)
      || ['Dockerfile', '.gitignore', '.dockerignore'].includes(path.basename(relative));
  }
  if (exampleInputs.has(relative) && (relative === EXAMPLE_CATALOG_FILE || relative.endsWith('.json'))) return true;
  if (/^examples\/[^/]+\.ya?ml$/.test(relative)) return false;
  return /\.(md|ya?ml|tsx?|png|svg)$/.test(relative);
};
const PAYLOAD_DOC_ROOT = /^(examples|docs)\//;
const payloadFileAllowed = (root, relative, exampleInputs) => !PAYLOAD_DOC_ROOT.test(relative) || payloadDocAllowed(root, relative, exampleInputs);

function validateExampleInclusion(root, rel) {
  let at = path.resolve(root);
  const parts = rel.split('/');
  for (const [index, part] of parts.entries()) {
    at = path.join(at, part);
    const stat = lstatSync(at, {throwIfNoEntry: false});
    if (!stat) return false; // Missing target members retain the existing update repair behavior.
    if (isLinkLike(at, {stat}) || (index === parts.length - 1 ? !stat.isFile() : !stat.isDirectory()))
      throw new Error(`declared example payload is linked or not regular: ${rel}`);
  }
  return true;
}

function walkDirectory(root, rel, exampleInputs, abs) {
  const out = [];
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    const next = rel ? `${rel}/${e.name}` : e.name;
    // Match npm payload semantics: dependency trees, VCS internals and `files` negations never ship,
    // and a junction/symlink entry is not ours to copy (a fixture may carry one inside node_modules).
    if (e.isSymbolicLink() || e.name === 'node_modules' || e.name === '.git' || isNegated(next)) continue;
    if (e.isDirectory()) out.push(...walk(root, next, exampleInputs));
    else if (payloadFileAllowed(root, next, exampleInputs)) out.push(next);
  }
  return out;
}

function walk(root, rel, exampleInputs) {
  if (isNegated(rel)) return [];
  const abs = path.join(root, rel);
  if (EXAMPLE_FILE_INCLUSIONS.has(rel) && !validateExampleInclusion(root, rel)) return [];
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return payloadFileAllowed(root, rel, exampleInputs) ? [rel] : [];
  return walkDirectory(root, rel, exampleInputs, abs);
}
export const payloadHash = (file, relative = '') => installedPayloadDigest(readFileSync(file), relative);
function exampleInputsFor(root, runtime) {
  const exampleInputs = new Set();
  if (runtime || existsSync(path.join(root, EXAMPLE_CATALOG_FILE))) {
    const references = exampleSourcePaths(root);
    exampleInputs.add(EXAMPLE_CATALOG_FILE);
    for (const relative of references) exampleInputs.add(relative);
    const apps = new Set([...discoverExampleApps(root), ...references.map(relative => relative.split('/')[1])]);
    for (const app of apps) exampleInputs.add(`${EXAMPLES_ROOT}/${app}/hfs.json`);
    for (const relative of exampleInputs) {
      const file = path.join(root, relative);
      if (isNegated(relative) || !payloadFileAllowed(root, relative, exampleInputs))
        throw new Error(`required example input is excluded from the payload: ${relative}`);
      if (isLinkLike(file) || !lstatSync(file).isFile()) throw new Error(`required example input is not a regular file: ${relative}`);
      if (relative.endsWith('.json')) {
        try { JSON.parse(readFileSync(file, 'utf8')); } catch { throw new Error(`invalid example JSON input: ${relative}`); }
      }
    }
  }
  return exampleInputs;
}

export const payloadFiles = (root) => {
  const manifest = path.join(root, 'package.json'), stat = lstatSync(manifest, {throwIfNoEntry: false});
  const runtime = stat?.isFile() && !isLinkLike(manifest) && JSON.parse(readFileSync(manifest, 'utf8')).name === pkg.name;
  const exampleInputs = exampleInputsFor(root, runtime);
  const files = [...new Set(PAYLOAD.flatMap((relative) => walk(root, relative, exampleInputs)))].sort(byCodeUnit);
  for (const relative of exampleInputs) if (!files.includes(relative))
    throw new Error(`required example input is missing from the payload: ${relative}`);
  return files;
};

function validatePriorManifest(priorManifest) {
  if (priorManifest.name !== pkg.name || typeof priorManifest.version !== 'string'
    || !priorManifest.files || typeof priorManifest.files !== 'object' || Array.isArray(priorManifest.files)
    || !Object.hasOwn(priorManifest.files, 'package.json')
    || Object.values(priorManifest.files).some(hash => typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)))
    throw new Error('invalid installed payload custody; refusing target inventory before writes');
}

function validateInstalledExamples(files, root, exampleInputs, repair) {
  if (repair) return;
  for (const relative of files) if (exampleInputs.has(relative) && relative.endsWith('.json')) {
    let value;
    try { value = JSON.parse(readFileSync(path.join(root, relative), 'utf8')); }
    catch { throw new Error(`invalid installed example JSON input: ${relative}`); }
    if (relative.endsWith('/hfs.json') && value?.kind !== 'app') throw new Error(`installed example has no HFS app declaration: ${relative}`);
  }
}

export const hashTree = (root, priorManifest = null, repair = false) => {
  if (!priorManifest) return Object.fromEntries(payloadFiles(root).map((rel) => [rel, payloadHash(path.join(root, rel), rel)]));
  // update has checked the protocol and stale path guards. Only its existing owner descriptor
  // can admit prior target JSON custody; this never changes the source package's strict gate.
  validatePriorManifest(priorManifest);
  const exampleInputs = new Set([...Object.keys(priorManifest.files), ...payloadFiles(packageRoot)]
    .filter(relative => relative === EXAMPLE_CATALOG_FILE || (relative.startsWith(`${EXAMPLES_ROOT}/`) && relative.endsWith('.json'))));
  const files = [...new Set(PAYLOAD.flatMap(relative => walk(root, relative, exampleInputs)))].sort(byCodeUnit);
  validateInstalledExamples(files, root, exampleInputs, repair);
  return Object.fromEntries(files.map(relative => [relative, payloadHash(path.join(root, relative), relative)]));
};


export function copyPayload(target) {
  // Validate every present target prefix before copying, including a fresh forced init without custody.
  for (const relative of EXAMPLE_FILE_INCLUSIONS) walk(target, relative, new Set());
  for (const relative of PAYLOAD) {
    if (!existsSync(path.join(packageRoot, relative))) throw new Error(`package is incomplete: ${relative} is missing`);
  }
  // Copy declared files, never recursively replace user-populated directories.
  // Files the payload no longer ships are handled only by the ownership-checked stale-file plan.
  for (const relative of payloadFiles(packageRoot)) {
    const to = path.join(target, relative);
    mkdirSync(path.dirname(to), { recursive: true });
    cpSync(path.join(packageRoot, relative), to);
  }
}
