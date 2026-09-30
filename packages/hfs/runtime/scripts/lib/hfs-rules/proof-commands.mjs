// proof-commands.mjs - HFS_PROOF_COMMAND_FILE_MISSING (R105): a proof command a `.starciwork` record names runs files that exist.
// A record's `requiresProof.<kind>.command` is "the exact command that satisfies this kind, runnable as written" (work-implementation
// schema); a command that names a spec, a script or a config the repository does not hold cannot be run as written, and a record that
// keeps one goes quietly false (nivo-backend, 2026-09-30: `node --test scripts/provision-keycloak.spec.mjs` after the script was deleted).
// Every argument of the command that is a repository-relative file path (an extension, no glob, no variable, not absolute, not a `..`
// path into another repository) must be a tracked file or an existing one; a path an ignored slot owns (dist/, coverage/) is a build
// product and is not judged. One finding per record, kind and missing path. A back end's `.starciwork` also holds the records of the
// implementations that live in another repository (`repository: nivo-fe`); their commands run there, so only a record of this repository
// (its `repository` names it, or names none) is judged.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../../engine/yaml.mjs';
import { repositoryName } from '../repo-identity.mjs';
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

/** The findings of R105 over the tracked paths `files` of the repository at `repoRoot`; `resolver` names the ignored slots. */
export function proofCommandFindings({ repoRoot, files, resolver }) {
  const findings = [];
  const tracked = new Set(files);
  const own = repositoryName(repoRoot);
  for (const file of files) {
    if (!RECORD.test(file)) continue;
    const text = readText(repoRoot, file);
    if (text === null || !text.includes('requiresProof')) continue;
    let record;
    try { record = parseYaml(text); } catch { continue; }
    if (typeof record?.repository === 'string' && record.repository !== own) continue;
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
