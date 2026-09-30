// stack-declaration.mjs - the one reader of a repository's stack declaration (.starcistacks/application-stacks.yaml): where it
// lives, its bounded read and parse, and the stack block of one service as declared. scripts/checks/check-starcistacks.mjs (the
// services contract) and scripts/lib/hfs-rules/stacks.mjs (the .starcistacks shape, R10) both read it here; this file imports
// nothing of the kernel, so the published @starci/hfs bundle carries it without the ledger.
import fs from 'node:fs';
import path from 'node:path';
import { isPlainObject as plain } from '../../engine/plain-object.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { isDir, isFile } from './fs-kind.mjs';
import { posixPath } from './path-key.mjs';

export const DECLARATION = 'application-stacks.yaml';
/** The one stack root a repository owns. */
export const STACK_ROOT = '.starcistacks';
const MAX_BYTES = 2 * 1024 * 1024;

/** A non-blank string, trimmed; anything else is null. */
export const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** The text of `file`, or null when it is absent or larger than 2 MiB. */
export const readText = (file) => { try { return fs.statSync(file).size > MAX_BYTES ? null : fs.readFileSync(file, 'utf8'); } catch { return null; } };

/** The parsed declaration file: {doc} or {error}. */
export function readDeclaration(file) {
  const raw = readText(file);
  if (raw === null) return { error: 'unreadable or larger than 2 MiB' };
  try { const doc = parseYaml(raw); return plain(doc) ? { doc } : { error: 'not a YAML mapping' }; }
  catch (error) { return { error: `YAML does not parse: ${String(error?.message ?? error).split('\n')[0]}` }; }
}

/**
 * The stack declaration a repository owns: {root, file, rooted, doc|error} - or {missing:true, rooted}
 * when .starcistacks/application-stacks.yaml does not exist. `rooted` says the .starcistacks tree exists.
 */
export function findStackDeclaration(repoRoot) {
  const repo = path.resolve(String(repoRoot ?? ''));
  const rooted = isDir(path.join(repo, STACK_ROOT));
  const file = path.join(repo, STACK_ROOT, DECLARATION);
  if (isFile(file)) return { repo, root: STACK_ROOT, file, rooted, ...readDeclaration(file) };
  return { repo, missing: true, rooted };
}

/**
 * The stack block of one declared service, or null when it has none: {owner, root, repository, hostOwned}. A stack is
 * host-owned when it says `owner: host` (it lives in the installed runtime tree, `.claude/ext/<service>`); `root` is posix.
 */
export function declaredStack(entry) {
  const stack = plain(entry) && plain(entry.stack) ? entry.stack : null;
  if (!stack) return null;
  const root = text(stack.root);
  return { owner: text(stack.owner), root: root === null ? null : posixPath(root), repository: text(stack.repository), hostOwned: text(stack.owner) === 'host' };
}
