#!/usr/bin/env node
// check-edge-case-registry.mjs - RT_EDGE_CASE_REGISTRY (R233; part of `npm run check`).
//   runs in the check stage (self-check edge-case-registry)
//
// modules/reconciler/edge-cases.yaml lists every edge case met. Each entry names a listed family, a real occurrence and a status
// of `covered` or `open`. A covered entry names the rule that handles it (a file, optionally with an `anchor` text the file
// contains) and the spec that reproduces it, and both exist; an open entry says why it is open. Ids are unique.
// An entry made from a defect found on a live host carries `found: live`; once covered it names the replay spec (`replay:`, a spec of tests/replay/ built on the
// replay harness tests/helpers/replay-world.mjs from a reduced fixture of the live sequence): a fix is not done until that spec passes (skills/starci/references/debug-loop.md).
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings } from '../lib/check-scan.mjs';
import { rolesContract } from '../machine/roles-contract.mjs';

export const CODE = 'RT_EDGE_CASE_REGISTRY';
export const REGISTRY_FILE = 'modules/reconciler/edge-cases.yaml';
const STATUSES = new Set(['covered', 'open']);
const VERDICTS = new Set(['departs', 'unjudged']);
const DUTIES = new Set(['does', 'cleanup', 'never', 'reportsUpWhen', 'bound']);
const REMEDY_STATES = new Set(['in-tree', 'on-host', 'open']);
const finding = (id, message) => ({ code: CODE, path: REGISTRY_FILE, line: 0, message: `${REGISTRY_FILE} ${id}: ${message}` });
const has = (root, file) => Boolean(file) && fs.existsSync(path.join(root, file));
const REPLAY_DIR = 'tests/replay/';
const REPLAY_HARNESS = 'helpers/replay-world.mjs';
const FOUND = new Set(['live']);

function coveredFindings(root, entry) {
  const out = [];
  const ruleFile = entry.rule?.file;
  if (!has(root, ruleFile)) out.push(finding(entry.id, `rule file ${ruleFile ?? '(none)'} does not exist`));
  else if (entry.rule.anchor && !fs.readFileSync(path.join(root, ruleFile), 'utf8').includes(entry.rule.anchor)) out.push(finding(entry.id, `rule file ${ruleFile} lacks the anchor ${entry.rule.anchor}`));
  if (!has(root, entry.spec)) out.push(finding(entry.id, `spec file ${entry.spec ?? '(none)'} does not exist`));
  return out;
}

/** A covered entry found on a live host names a replay spec of tests/replay/ that drives the replay harness; an open one may name it too. */
function replayFindings(root, entry) {
  if (entry.found == null) return [];
  if (!FOUND.has(entry.found)) return [finding(entry.id, `found must be live, got ${entry.found}`)];
  if (entry.replay == null) return entry.status === 'covered' ? [finding(entry.id, 'was found live and is covered but names no replay spec (replay: tests/replay/<case>.spec.mjs)')] : [];
  if (!String(entry.replay).startsWith(REPLAY_DIR) || !String(entry.replay).endsWith('.spec.mjs')) return [finding(entry.id, `replay ${entry.replay} is not a spec of ${REPLAY_DIR}`)];
  if (!has(root, entry.replay)) return [finding(entry.id, `replay spec ${entry.replay} does not exist`)];
  return fs.readFileSync(path.join(root, entry.replay), 'utf8').includes(REPLAY_HARNESS) ? [] : [finding(entry.id, `replay spec ${entry.replay} does not use the replay harness (${REPLAY_HARNESS})`)];
}

/** A finding names the role that departed, the contract field it broke, its evidence and the state of its remedy; a correct error is no finding. */
function findingFindings(entry, roleIds) {
  const f = entry.finding;
  if (!f) return [];
  const out = [];
  if (!roleIds.has(f.role)) out.push(finding(entry.id, `finding role ${f.role} is not a role of the roles contract`));
  if (!DUTIES.has(f.duty)) out.push(finding(entry.id, `finding duty ${f.duty} is not a field of a role block`));
  if (!VERDICTS.has(f.verdict)) out.push(finding(entry.id, 'finding verdict must be departs or unjudged: a correct error is no finding'));
  if (!f.evidence) out.push(finding(entry.id, 'finding names no evidence'));
  if (!REMEDY_STATES.has(f.remedy?.state)) out.push(finding(entry.id, 'finding remedy state must be in-tree, on-host or open'));
  if (entry.status === 'covered' && f.remedy?.state === 'open') out.push(finding(entry.id, 'is covered while its finding remedy is open'));
  return out;
}

function entryFindings(root, entry, families) {
  const out = [];
  if (!families.has(entry.family)) out.push(finding(entry.id, `family ${entry.family} is not listed`));
  if (!STATUSES.has(entry.status)) out.push(finding(entry.id, `status must be covered or open`));
  if (!entry.met?.date || !entry.met?.where || !entry.met?.evidence) out.push(finding(entry.id, 'lacks the occurrence (met.date, met.where, met.evidence)'));
  out.push(...findingFindings(entry, new Set([...rolesContract(root).roles.map((r) => r.id), 'runtime'])));
  if (entry.status === 'covered') out.push(...coveredFindings(root, entry));
  out.push(...replayFindings(root, entry));
  if (entry.status === 'open' && !entry.why) out.push(finding(entry.id, 'is open and says no why'));
  return out;
}

/** The RT_EDGE_CASE_REGISTRY findings over the tree at `root`. */
export function checkEdgeCaseRegistry(root = skillRoot) {
  const doc = parseYaml(fs.readFileSync(path.join(root, REGISTRY_FILE), 'utf8'));
  const families = new Set(doc.families);
  const seen = new Set();
  const dupes = doc.cases.filter((entry) => seen.size === seen.add(entry.id).size).map((entry) => finding(entry.id, 'is listed twice'));
  return [...dupes, ...doc.cases.flatMap((entry) => entryFindings(root, entry, families))];
}

if (isMain(import.meta.url)) process.exitCode = printFindings(checkEdgeCaseRegistry(), 'OK: every covered edge case names an existing rule and spec.');
