import fs from 'node:fs';
import path from 'node:path';
import { lsFiles } from '../../api/git/ls-files.mjs';
import { revParseQuery } from '../../api/git/rev-parse-query.mjs';
import { gitOutputOf } from '../../lib/git.mjs';
import { trimTrailingSlashes } from '../trailing-slashes.mjs';

/**
 * HFS check 5: the files and directories the slot manifest requires (knowledge/hfs/slots.yaml `requires`,
 * `requiredInstances`, `minInstances`, required app kinds) must exist in the repository tree. Everything is read through the
 * resolver of scripts/hfs/slots.mjs; nothing here names a path.
 *
 *   FE_ERROR_BOUNDARY_MISSING    a fe.app.next app lacks global-error, error, not-found or loading under src/app
 *   HFS_REQUIRED_FILE_MISSING    any other required file or directory of any slot (backend app, feature, domain, integrations and
 *                                platform instances, a required platform instance such as config or logging, packages, fe modules,
 *                                i18n, api ...), and a minimum (no api app, no feature, no next app) which is reported once at hfs.json
 *
 * Slots of tier none (README, root config, .starciwork, .starcistacks) belong to the slot check; fe.app.next is the one
 * tier-none slot judged here. The tree is the tracked one (`git ls-files` from the repository root, minus files deleted
 * on disk), else the filesystem without node_modules, .git, dist and .next.
 */
export const REQUIRED_FILE_RULE_IDS = ['FE_ERROR_BOUNDARY_MISSING', 'HFS_REQUIRED_FILE_MISSING'];

const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', '.next']);
const ERROR_BOUNDARY_FILE = /^(?:global-error|error|not-found|loading)\.tsx$/u;
const ALSO_JUDGED_TIER_NONE = new Set(['fe.app.next']);

function gitFiles(root) {
  try {
    const run = (call, args) => gitOutputOf(call(args, { cwd: root, maxBuffer: 256 * 1024 * 1024 }));
    run(revParseQuery, ['--is-inside-work-tree']);
    const deleted = new Set(run(lsFiles, ['--deleted', '-z', '--', '.']).split('\0').filter(Boolean));
    return run(lsFiles, ['--cached', '-z', '--', '.']).split('\0').filter(file => file && !deleted.has(file));
  } catch {
    return null;
  }
}

function diskFiles(root, relative = '') {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(path.join(root, ...relative.split('/').filter(Boolean)), { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...diskFiles(root, child));
    else out.push(child);
  }
  return out;
}

/** The repository tree as file and directory sets over posix relatives. */
export function treeOf(root) {
  const list = gitFiles(root) ?? diskFiles(root);
  const files = new Set(list);
  const directories = new Set();
  for (const file of list) {
    const parts = file.split('/');
    for (let i = 1; i < parts.length; i += 1) directories.add(parts.slice(0, i).join('/'));
  }
  return { files, directories };
}

/**
 * The prelude every tree-walking architecture checker shares: the input's config/graph/context, the compiler,
 * the slot resolver and the tracked repository tree.
 */
export function checkerScope({ config, graph, context }) {
  return { config, graph, context, ts: context.ts, resolver: graph.resolver, tree: treeOf(config.root) };
}

const rootOfTarget = target => {
  if (target.endsWith('/')) return trimTrailingSlashes(target);
  const parent = path.posix.dirname(target);
  return parent === '.' ? '' : parent;
};

function ruleFor(slotId, target, rootExists) {
  if (slotId === 'fe.app.next' && rootExists && ERROR_BOUNDARY_FILE.test(path.posix.basename(trimTrailingSlashes(target)))) return 'FE_ERROR_BOUNDARY_MISSING';
  return 'HFS_REQUIRED_FILE_MISSING';
}

function slotIsJudged(resolver, slotId) {
  const slot = resolver.slot(slotId);
  return Boolean(slot) && (slot.tier !== 'none' || ALSO_JUDGED_TIER_NONE.has(slotId));
}

function addRequirement(requirements, slot, target, root) {
  if (!requirements.has(target)) requirements.set(target, { slot, target, root });
}

function collectDeclaredRequirements(declared, requirements, instances, judged) {
  const currentRoot = new Map();
  for (const item of declared.paths) {
    if (!judged(item.slot)) continue;
    if (item.via !== 'requires') {
      const root = rootOfTarget(item.path);
      currentRoot.set(item.slot, root);
      instances.add(`${item.slot}|${root}`);
      addRequirement(requirements, item.slot, item.path, root);
    } else {
      addRequirement(requirements, item.slot, item.path, currentRoot.get(item.slot) ?? '');
    }
  }
}

function addInstanceRequirements(resolver, classified, representative, requirements, instances, seenInstances, judged) {
  const { slot: slotId, root } = classified;
  const key = `${slotId}|${root}`;
  if (seenInstances.has(key) || !judged(slotId)) return;
  seenInstances.add(key);
  instances.add(key);
  for (const target of resolver.requiredFiles(representative)) addRequirement(requirements, slotId, target, root);
}

function addOwnerRequirements(resolver, owner, requirements, instances, seenInstances, judged) {
  const key = `${owner.slot}|${owner.root}`;
  if (seenInstances.has(key) || !judged(owner.slot) || !resolver.slotEnabled(resolver.slot(owner.slot))) return;
  seenInstances.add(key);
  instances.add(key);
  for (const entry of resolver.slot(owner.slot).requires ?? []) {
    const rooted = entry.startsWith('/');
    const filled = (rooted ? entry.slice(1) : entry).replace(/<([A-Za-z][A-Za-z0-9-]*)>/g, (whole, name) => owner.bindings[name] ?? whole);
    addRequirement(requirements, owner.slot, rooted || !owner.root ? filled : `${owner.root}/${filled}`, owner.root);
  }
}

function noteInstance(found, slotId, root) {
  if (!found.has(slotId)) found.set(slotId, new Set());
  found.get(slotId).add(root);
}

function collectTreeRequirements(tree, resolver, requirements, instances, judged) {
  const seenInstances = new Set();
  const found = new Map(); // slot -> Set(root) of instances seen while walking
  for (const file of tree.files) {
    const classified = resolver.classifyPath(file);
    if (classified.status === 'owned' && classified.slot) {
      noteInstance(found, classified.slot, classified.root);
      addInstanceRequirements(resolver, classified, file, requirements, instances, seenInstances, judged);
    }
    const owner = resolver.ownerOf(file);
    if (owner) {
      noteInstance(found, owner.slot, owner.root);
      // an owner root may classify to a more specific slot (modules/i18n) or a nested one, so expand the owner slot's own requires
      addOwnerRequirements(resolver, owner, requirements, instances, seenInstances, judged);
    }
  }
  return found;
}

function requirementExists(tree, target) {
  return target.endsWith('/') ? tree.directories.has(trimTrailingSlashes(target)) : tree.files.has(target);
}

function reportMissingRequirement(requirement, tree, report) {
  if (requirementExists(tree, requirement.target)) return;
  const rootExists = !requirement.root || tree.directories.has(requirement.root);
  if (!rootExists) {
    report(ruleFor(requirement.slot, requirement.target, false), requirement.root, requirement.slot, requirement.root, { kind: 'directory' },
      `Required directory ${requirement.root} (slot ${requirement.slot}) does not exist; the slot manifest requires it, along with what it holds.`);
    return;
  }
  const kind = requirement.target.endsWith('/') ? 'directory' : 'file';
  const rootNote = requirement.root ? ` (${requirement.root})` : '';
  report(ruleFor(requirement.slot, requirement.target, true), trimTrailingSlashes(requirement.target), requirement.slot, requirement.root, { kind },
    `Required ${kind} ${trimTrailingSlashes(requirement.target)} is missing; slot ${requirement.slot} requires it in every instance${rootNote}.`);
}

function reportMissingRequirements(requirements, tree, report) {
  for (const requirement of requirements.values()) reportMissingRequirement(requirement, tree, report);
}

function reportMinimumRequirements(minimums, resolver, judged, found, report) {
  for (const minimum of minimums) {
    if (!judged(minimum.slot)) continue;
    const count = minimum.appKind !== undefined
      ? resolver.repo.apps.filter(app => app.kind === minimum.appKind).length
      : (found.get(minimum.slot)?.size ?? 0);
    if (count >= minimum.min) continue;
    const appKindNote = minimum.appKind ? ' (an app of kind ' + minimum.appKind + ' declared in hfs.json)' : '';
    report('HFS_REQUIRED_FILE_MISSING', 'hfs.json', minimum.slot, '', { minimum: minimum.min, found: count },
      `Slot ${minimum.slot} needs at least ${minimum.min} instance${minimum.min === 1 ? '' : 's'}${appKindNote}; the repository has ${count}.`);
  }
}

export function checkRequiredFiles({ config, graph }) {
  const resolver = graph?.resolver ?? config.hfs;
  const tree = treeOf(config.root);
  const judged = slotId => slotIsJudged(resolver, slotId);

  const requirements = new Map(); // repository-relative target (as written, dirs end with /) -> {slot, target, root}
  const instances = new Set();
  const declared = resolver.requiredPaths();
  collectDeclaredRequirements(declared, requirements, instances, judged);

  const found = collectTreeRequirements(tree, resolver, requirements, instances, judged);

  const violations = [];
  const reported = new Set();
  const report = (ruleId, target, slotId, root, extra, message) => {
    const key = `${ruleId}|${target}`;
    if (reported.has(key)) return;
    reported.add(key);
    violations.push({ ruleId, path: target, slot: slotId, ...(root ? { root } : {}), ...extra, message });
  };
  reportMissingRequirements(requirements, tree, report);

  reportMinimumRequirements(declared.minimums, resolver, judged, found, report);

  return { violations, coverage: { status: 'checked', instances: instances.size, requirements: requirements.size, missing: violations.length } };
}
