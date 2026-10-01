// proof-commands.mjs - HFS_PROOF_COMMAND_FILE_MISSING (R105): a proof command a `.starciwork` record names runs files that exist.
// A record's `requiresProof.<kind>.command` is "the exact command that satisfies this kind, runnable as written" (work-implementation
// schema); a command that names a spec, a script or a config the repository does not hold cannot be run as written, and a record that
// keeps one goes quietly false (nivo-backend, 2026-09-30: `node --test scripts/provision-keycloak.spec.mjs` after the script was deleted).
// Every argument of the command that is a repository-relative file path (an extension, no glob, no variable, not absolute, not a `..`
// path into another repository) must be a tracked file or an existing one; a path an ignored slot owns (dist/, coverage/) is a build
// product and is not judged. One finding per record, kind and missing path. The `.starciwork` of an app sits at the app root, and a
// record names the side its implementation lives in (`repository: be` or `repository: fe`, the repositories of workspace.yaml, the
// sides of hfs.json); a proof command runs from the app root, so every record of a side, or naming none, is judged against the app root.
// A record naming a repository that is not a side of this app runs elsewhere and is not judged.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../../engine/yaml.mjs';
import { found, readText } from './read.mjs';

export const PROOF_COMMAND_FILE_MISSING = 'HFS_PROOF_COMMAND_FILE_MISSING';
const RECORD = /^\.starciwork\/.+\.ya?ml$/;
const FILE_ARGUMENT = /^(?:\.\/)?[\w@][\w@.\-[\]()]*(?:\/[\w@.\-[\]()]+)*\.[A-Za-z][A-Za-z0-9]{0,7}$/;
const PATH_SEPARATOR = /\//;

/** The arguments of a shell command line that name a repository file, in order, without duplicates. */
export function commandFiles(command) {
  const words = String(command).split(/[\s&|;()<>]+/).filter(Boolean).map((word) => word.replace(/^['"]|['"]$/g, ''));
  const files = [];
  for (const word of words) {
    if (word.startsWith('-') || word.startsWith('..') || path.isAbsolute(word) || /^[A-Za-z]:/.test(word) || /^[a-z]+:\/\//.test(word)) continue;
    if (!PATH_SEPARATOR.test(word) || /[*$`{}~=]/.test(word)) continue;
    if (!FILE_ARGUMENT.test(word)) continue;
    const clean = word.replace(/^\.\//, '');
    if (!files.includes(clean)) files.push(clean);
  }
  return files;
}

/** Every `requiresProof.<kind>.command` of a parsed record: [{ kind, command }]. */
function proofCommands(record) {
  const demands = record && typeof record === 'object' ? record.requiresProof : null;
  if (!demands || typeof demands !== 'object') return [];
  return Object.entries(demands).flatMap(([kind, demand]) => (typeof demand?.command === 'string' ? [{ kind, command: demand.command }] : []));
}

/**
 * The findings of R105 over the tracked paths `files` of the app at `repoRoot`; `resolver` names the ignored slots and `sides` the side
 * names of hfs.json (be, fe), the repositories a record of this app names.
 */
export function proofCommandFindings({ repoRoot, files, resolver, sides }) {
  const findings = [];
  const tracked = new Set(files);
  const own = new Set(sides);
  for (const file of files) {
    if (!RECORD.test(file)) continue;
    const text = readText(repoRoot, file);
    if (text === null || !text.includes('requiresProof')) continue;
    let record;
    try { record = parseYaml(text); } catch { continue; }
    if (typeof record?.repository === 'string' && !own.has(record.repository)) continue;
    for (const { kind, command } of proofCommands(record)) {
      for (const target of commandFiles(command)) {
        if (tracked.has(target) || fs.existsSync(path.join(repoRoot, target))) continue;
        const classified = resolver.classifyPath(target);
        if (classified.status === 'owned' && classified.tracking === 'ignored') continue;
        findings.push(found(PROOF_COMMAND_FILE_MISSING, file, `${file} requiresProof.${kind}.command runs ${target}, which the repository does not hold; a proof command is runnable as written: create the file or rewrite the proof plan`, { kind, missing: target }));
      }
    }
  }
  return findings;
}
