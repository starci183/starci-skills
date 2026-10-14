// Optional release-cut witnesses mutate isolated authored example copies; no source custody files are opened.
import fs from 'node:fs';
import path from 'node:path';
import { tempRoot } from '../../../engine/temp-root.mjs';
import { isPlainObject } from '../../../engine/plain-object.mjs';
import { init } from '../../api/git/init.mjs';
import { add } from '../../api/git/add.mjs';
import { generatedRootsOf } from '../../lib/check-scan.mjs';
import { eachInOrder } from '../../lib/in-order.mjs';
import { judgedInEdition } from '../../hfs/edition-slots.mjs';
import { checkRepository } from '../../hfs/check.mjs';
import { coverageSafePath } from './coverage-inventory.mjs';

const CODE = 'RT_COVERAGE_NO_WITNESS';
const PREFIX = 'hfs-coverage-witness-';
const FINDING_CODE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;
const GENERATED = /(?:^|\/)(?:runtime|dist|coverage|\.runtimes|artifacts|generated)(?:\/|$)/;
const UNSAFE_COMPONENT = /[\u0000-\u001f<>:"|?*]|[. ]$|^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
class WitnessRefusal extends Error {}
const refuse = (message) => { throw new WitnessRefusal(message); };
const finding = (rule, edition, index, message) => ({ code: CODE, level: 'warning', rule: rule.id, edition,
  path: 'knowledge/hfs/rules.yaml', message: `${rule.id} witness ${index + 1}: ${message}` });

function relativePath(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0') || path.isAbsolute(value)
    || path.win32.isAbsolute(value) || value.includes(':')) refuse(`${label} must be a repository-relative path`);
  const rel = value.replaceAll('\\', '/');
  if (rel.split('/').some((part) => !part || part === '.' || part === '..' || UNSAFE_COMPONENT.test(part))) refuse(`${label} has an unsafe path component`);
  return rel;
}

const within = (base, target) => {
  const rel = path.relative(base, target);
  return rel !== '' && !rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel);
};
const safeAuthoredPath = (rel, generated) => coverageSafePath(rel) && !GENERATED.test(rel)
  && !/(?:^|\/)[^/]+\.env$/i.test(rel) && !generated.some((prefix) => `${rel}/`.startsWith(prefix));

/** Resolve a child path without following an authored symlink or escaping the intended directory. */
function childPath(base, rel) {
  const target = path.resolve(base, ...rel.split('/'));
  if (!within(base, target)) refuse('path escapes its intended directory');
  let current = base;
  for (const component of rel.split('/')) {
    current = path.join(current, component);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (stat?.isSymbolicLink()) refuse('symlink paths cannot be used as witnesses');
    if (stat && current !== target && !stat.isDirectory()) refuse('path crosses a non-directory entry');
  }
  return target;
}

function validateWitness(rule, witness) {
  if (!isPlainObject(witness) || Object.keys(witness).some((key) => !['edition', 'base', 'mutate', 'expect'].includes(key))) refuse('witness metadata must name edition, base, mutate and expect');
  if (!['lite', 'full'].includes(witness.edition) || !judgedInEdition(rule, witness.edition)) refuse('witness edition must be an edition the rule judges');
  const base = relativePath(witness.base, 'base');
  if (!/^examples\/[^/]+$/.test(base)) refuse('base must name one authored example under examples/');
  if (!Array.isArray(witness.expect) || !witness.expect.length || !witness.expect.every((code) => typeof code === 'string' && FINDING_CODE.test(code))
    || new Set(witness.expect).size !== witness.expect.length) refuse('expect must contain distinct finding codes');
  if (rule.failureCodes?.length && !witness.expect.some((code) => rule.failureCodes.includes(code))) refuse('expect must include a code owned by the rule');
  if (!Array.isArray(witness.mutate) || !witness.mutate.length) refuse('mutate must contain at least one mutation');
  const mutations = witness.mutate.map((mutation) => {
    if (!isPlainObject(mutation) || Object.keys(mutation).some((key) => !['op', 'path', 'content'].includes(key))
      || !['add', 'edit', 'delete'].includes(mutation.op)) refuse('mutation must use add, edit or delete');
    const rel = relativePath(mutation.path, 'mutation path');
    if (mutation.op === 'delete' ? mutation.content !== undefined : typeof mutation.content !== 'string') refuse('add/edit need text content and delete has no content');
    return { ...mutation, path: rel };
  });
  return { base, mutations };
}

function copyAuthored(source, destination, root, generated) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const rel = path.relative(root, from).replaceAll('\\', '/');
    // Exclude before reading file bytes or traversing a junction, including node_modules and sealed members.
    if (!safeAuthoredPath(rel, generated)) continue;
    const stat = fs.lstatSync(from);
    if (stat.isSymbolicLink()) refuse('an authored example contains a symlink');
    const to = path.join(destination, entry.name);
    if (stat.isDirectory()) copyAuthored(from, to, root, generated);
    else if (stat.isFile()) fs.copyFileSync(from, to);
    else refuse('an authored example contains a non-file entry');
  }
}

function applyMutation(repoRoot, mutation) {
  const target = childPath(repoRoot, mutation.path);
  const stat = fs.lstatSync(target, { throwIfNoEntry: false });
  if (mutation.op === 'add' && stat) refuse('add cannot replace an existing path');
  if (mutation.op !== 'add' && !stat) refuse(`${mutation.op} requires an existing path`);
  if (mutation.op === 'delete') { fs.rmSync(target, { recursive: stat.isDirectory() }); return; }
  if (stat && !stat.isFile()) refuse('edit requires a regular file');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, mutation.content, { encoding: 'utf8', flag: mutation.op === 'add' ? 'wx' : 'w' });
}

/** Fresh Git metadata lets the repository judge read tracked paths; no source repository metadata or hooks survive. */
function gitSandbox(repoRoot, allocated) {
  const hooks = path.join(allocated, 'hooks');
  const template = path.join(allocated, 'template');
  const configFile = path.join(allocated, 'empty.gitconfig');
  fs.mkdirSync(hooks);
  fs.mkdirSync(template);
  fs.writeFileSync(configFile, '');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  Object.assign(env, { GIT_CONFIG_GLOBAL: configFile, GIT_CONFIG_SYSTEM: configFile, GIT_CONFIG_NOSYSTEM: '1',
    GIT_ATTR_NOSYSTEM: '1', GIT_TEMPLATE_DIR: template });
  if (!init(repoRoot, { env }).ok) refuse('temporary witness repository could not be initialized');
  const config = { 'core.hooksPath': hooks, 'core.attributesFile': '', 'core.excludesFile': '' };
  return () => {
    const staged = add(['--force', '--all'], { cwd: repoRoot, env, config });
    if (staged.error || staged.status !== 0) refuse('temporary witness paths could not be staged');
  };
}

function observedCodes(result) {
  if (!Array.isArray(result?.findings)) refuse('witness judge returned no findings list');
  return new Set(result.findings.map((item) => item.code));
}

function removeAllocated(allocated, parent) {
  const stat = fs.lstatSync(allocated, { throwIfNoEntry: false });
  if (!stat) return;
  if (!within(parent, allocated) || path.dirname(allocated) !== parent || !path.basename(allocated).startsWith(PREFIX)
    || stat.isSymbolicLink() || !stat.isDirectory() || fs.realpathSync.native(allocated) !== allocated) refuse('temporary witness cleanup path could not be verified');
  fs.rmSync(allocated, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 });
}

function witnessSource(context, rule, witness, generated) {
  const { base, mutations } = validateWitness(rule, witness);
  if (!safeAuthoredPath(base, generated) || mutations.some((mutation) => !safeAuthoredPath(`${base}/${mutation.path}`, generated))) refuse('witness paths must contain authored files outside custody and generated trees');
  const source = childPath(context.root, base);
  if (!fs.statSync(source, { throwIfNoEntry: false })?.isDirectory()) refuse('witness base example does not exist');
  return { source, mutations };
}

function allocateWitness(deps) {
  let parent = path.resolve(typeof deps.tempRoot === 'function' ? deps.tempRoot() : deps.tempRoot ?? tempRoot());
  fs.mkdirSync(parent, { recursive: true });
  parent = fs.realpathSync.native(parent);
  const allocated = fs.realpathSync.native(fs.mkdtempSync(path.join(parent, PREFIX)));
  return { allocated, parent, repoRoot: path.join(allocated, 'repo') };
}

async function proveWitness(context, rule, witness, mutations, sandbox, deps) {
  const { repoRoot, allocated } = sandbox;
  const declaration = JSON.parse(fs.readFileSync(childPath(repoRoot, 'hfs.json'), 'utf8'));
  if ((declaration.edition ?? 'full') !== witness.edition) refuse('base example edition differs from witness edition');
  const stage = deps.judge ? () => {} : gitSandbox(repoRoot, allocated);
  const judge = deps.judge ?? checkRepository;
  const input = { ...context, repoRoot, rule, edition: witness.edition, witness };
  stage();
  const baseline = observedCodes(await judge(input));
  if (witness.expect.some((code) => baseline.has(code))) refuse('base example already reports an expected code; the mutation does not prove it');
  for (const mutation of mutations) { applyMutation(repoRoot, mutation); stage(); }
  const mutated = observedCodes(await judge(input));
  const missing = witness.expect.filter((code) => !mutated.has(code));
  if (missing.length) refuse(`mutation did not report ${missing.join(', ')}`);
}

function cleanupWitness(sandbox, rule, witness, index, out) {
  if (!sandbox) return;
  try { removeAllocated(sandbox.allocated, sandbox.parent); } catch { out.push(finding(rule, witness?.edition, index, 'temporary witness copy could not be safely cleaned up')); }
}

async function runWitness(context, rule, witness, index, deps, generated) {
  const out = [];
  let sandbox;
  try {
    const { source, mutations } = witnessSource(context, rule, witness, generated);
    sandbox = allocateWitness(deps);
    copyAuthored(source, sandbox.repoRoot, context.root, generated);
    await proveWitness(context, rule, witness, mutations, sandbox, deps);
  } catch (error) {
    out.push(finding(rule, witness?.edition, index, error instanceof WitnessRefusal ? error.message : 'witness could not be evaluated'));
  } finally { cleanupWitness(sandbox, rule, witness, index, out); }
  return out;
}

/** The opt-in L4 layer; call under the external weight-2 wrapper. Inject judge/tempRoot for isolated specs. */
export async function runCoverageWitnesses({ root, catalog, manifest }, deps = {}) {
  const context = { root: fs.realpathSync.native(path.resolve(root)), manifest };
  const generated = generatedRootsOf(context.root);
  const findings = [];
  await eachInOrder(catalog.rules ?? [], async (rule) => {
    if (rule.witness === undefined) return;
    if (rule.witness?.status === 'unreachable' && typeof rule.witness.reason === 'string' && rule.witness.reason.trim()
      && /^\d{4}-\d{2}-\d{2}$/.test(rule.witness.date ?? '')) return;
    if (!Array.isArray(rule.witness) || !rule.witness.length) {
      findings.push(finding(rule, undefined, 0, 'witness must contain mutations or a dated unreachable reason'));
      return;
    }
    await eachInOrder(rule.witness, async (witness, index) => findings.push(...await runWitness(context, rule, witness, index, deps, generated)));
  });
  return findings;
}
