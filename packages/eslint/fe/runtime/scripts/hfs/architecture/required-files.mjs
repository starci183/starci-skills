import fs from 'node:fs';
import path from 'node:path';
import { lsFiles } from '../../api/git/ls-files.mjs';
import { revParseQuery } from '../../api/git/rev-parse-query.mjs';
import { gitOutputOf } from '../../lib/git.mjs';

/**
 * HFS check 5: the files and directories the slot manifest requires (knowledge/hfs/slots.yaml `requires`,
 * `requiredInstances`, `minInstances`, required app kinds) must exist in the repository tree. Everything is read through the
 * resolver of scripts/hfs/slots.mjs; nothing here names a path.
 *
 *   BE_REQUIRED_MODULE_MISSING   a backend app, feature, domain, integrations or platform instance lacks a required file or
 *                                directory, or a required platform instance (config, logging, errors, primitives) is absent
 *   FE_ERROR_BOUNDARY_MISSING    a fe.app.next app lacks global-error, error, not-found or loading under src/app
 *   HFS_REQUIRED_FILE_MISSING    any other required file or directory (packages, fe modules, i18n, api ...), and a minimum
 *                                (no api app, no feature, no next app) which is reported once at hfs.json
 *
 * Slots of tier none (README, root config, .starciwork, .starcistacks) belong to the slot check; fe.app.next is the one
 * tier-none slot judged here. The tree is the tracked one (`git ls-files` from the repository root, minus files deleted
 * on disk), else the filesystem without node_modules, .git, dist and .next.
 */
export const REQUIRED_FILE_RULE_IDS = ['BE_REQUIRED_MODULE_MISSING', 'FE_ERROR_BOUNDARY_MISSING', 'HFS_REQUIRED_FILE_MISSING'];

const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', '.next']);
const ERROR_BOUNDARY_FILE = /^(?:global-error|error|not-found|loading)\.tsx$/u;
const BACKEND_MODULE_SLOT = /^be\.(?:app|feature|transport|domain|integrations|platform)(?:\.|$)/u;
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

const strip = entry => entry.replace(/\/+$/u, '');
const rootOfTarget = target => (target.endsWith('/') ? strip(target) : (path.posix.dirname(target) === '.' ? '' : path.posix.dirname(target)));

function ruleFor(slotId, target, rootExists) {
  if (slotId === 'fe.app.next' && rootExists && ERROR_BOUNDARY_FILE.test(path.posix.basename(strip(target)))) return 'FE_ERROR_BOUNDARY_MISSING';
  return BACKEND_MODULE_SLOT.test(slotId) ? 'BE_REQUIRED_MODULE_MISSING' : 'HFS_REQUIRED_FILE_MISSING';
}

export function checkRequiredFiles({ config, graph }) {
  const resolver = graph?.resolver ?? config.hfs;
  const tree = treeOf(config.root);
  const judged = slotId => {
    const slot = resolver.slot(slotId);
    return Boolean(slot) && (slot.tier !== 'none' || ALSO_JUDGED_TIER_NONE.has(slotId));
  };

  const requirements = new Map(); // repository-relative target (as written, dirs end with /) -> {slot, target, root}
  const instances = new Set();
  const addRequirement = (slot, target, root) => { if (!requirements.has(target)) requirements.set(target, { slot, target, root }); };

  // 1. What the repository must hold whatever it contains: fixed instances (requiredInstances, one per declared app).
  const declared = resolver.requiredPaths();
  const currentRoot = new Map();
  for (const item of declared.paths) {
    if (!judged(item.slot)) continue;
    if (item.via !== 'requires') {
      const root = rootOfTarget(item.path);
      currentRoot.set(item.slot, root);
      instances.add(`${item.slot}|${root}`);
      addRequirement(item.slot, item.path, root);
    } else {
      addRequirement(item.slot, item.path, currentRoot.get(item.slot) ?? '');
    }
  }

  // 2. What each instance found by walking the tree requires (features, domains, integrations, packages, transports, ...).
  const seenInstances = new Set();
  const instanceRequires = (slotId, root, representative) => {
    const key = `${slotId}|${root}`;
    if (seenInstances.has(key) || !judged(slotId)) return;
    seenInstances.add(key);
    instances.add(key);
    for (const target of resolver.requiredFiles(representative)) addRequirement(slotId, target, root);
  };
  const ownerRequires = owner => {
    const key = `${owner.slot}|${owner.root}`;
    if (seenInstances.has(key) || !judged(owner.slot) || !resolver.slotEnabled(resolver.slot(owner.slot))) return;
    seenInstances.add(key);
    instances.add(key);
    for (const entry of resolver.slot(owner.slot).requires ?? []) {
      const rooted = entry.startsWith('/');
      const filled = (rooted ? entry.slice(1) : entry).replace(/<([A-Za-z][A-Za-z0-9-]*)>/g, (whole, name) => owner.bindings[name] ?? whole);
      addRequirement(owner.slot, rooted || !owner.root ? filled : `${owner.root}/${filled}`, owner.root);
    }
  };
  const found = new Map(); // slot -> Set(root) of instances seen while walking
  const note = (slotId, root) => {
    if (!found.has(slotId)) found.set(slotId, new Set());
    found.get(slotId).add(root);
  };
  for (const file of tree.files) {
    const classified = resolver.classifyPath(file);
    if (classified.status === 'owned' && classified.slot) {
      note(classified.slot, classified.root);
      instanceRequires(classified.slot, classified.root, file);
    }
    const owner = resolver.ownerOf(file);
    if (owner) {
      note(owner.slot, owner.root);
      // an owner root may classify to a more specific slot (modules/i18n) or a nested one, so expand the owner slot's own requires
      ownerRequires(owner);
    }
  }

  const violations = [];
  const reported = new Set();
  const report = (ruleId, target, slotId, root, extra, message) => {
    const key = `${ruleId}|${target}`;
    if (reported.has(key)) return;
    reported.add(key);
    violations.push({ ruleId, path: target, slot: slotId, ...(root ? { root } : {}), ...extra, message });
  };
  const exists = target => (target.endsWith('/') ? tree.directories.has(strip(target)) : tree.files.has(target));

  for (const requirement of requirements.values()) {
    if (exists(requirement.target)) continue;
    const rootExists = !requirement.root || tree.directories.has(requirement.root);
    if (!rootExists) {
      report(ruleFor(requirement.slot, requirement.target, false), requirement.root, requirement.slot, requirement.root, { kind: 'directory' },
        `Required directory ${requirement.root} (slot ${requirement.slot}) does not exist; the slot manifest requires it, along with what it holds.`);
      continue;
    }
    const kind = requirement.target.endsWith('/') ? 'directory' : 'file';
    report(ruleFor(requirement.slot, requirement.target, true), strip(requirement.target), requirement.slot, requirement.root, { kind },
      `Required ${kind} ${strip(requirement.target)} is missing; slot ${requirement.slot} requires it in every instance${requirement.root ? ` (${requirement.root})` : ''}.`);
  }

  // 3. Minimums: at least minInstances instances of a required slot.
  for (const minimum of declared.minimums) {
    if (!judged(minimum.slot)) continue;
    const count = minimum.appKind !== undefined
      ? resolver.repo.apps.filter(app => app.kind === minimum.appKind).length
      : (found.get(minimum.slot)?.size ?? 0);
    if (count >= minimum.min) continue;
    report('HFS_REQUIRED_FILE_MISSING', 'hfs.json', minimum.slot, '', { minimum: minimum.min, found: count },
      `Slot ${minimum.slot} needs at least ${minimum.min} instance${minimum.min === 1 ? '' : 's'}${minimum.appKind ? ` (an app of kind ${minimum.appKind} declared in hfs.json)` : ''}; the repository has ${count}.`);
  }

  return { violations, coverage: { status: 'checked', instances: instances.size, requirements: requirements.size, missing: violations.length } };
}
