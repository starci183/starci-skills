#!/usr/bin/env node
// check-roles-contract.mjs - RT_ROLES_CONTRACT_DRIFT (R232; part of `npm run check`).
//   runs in the check stage (self-check roles-contract); --write regenerates the role blocks
//
// The roles contract (modules/kernel/roles.yaml) is the one description of a role. A surface in `block` mode carries the
// Markdown block generated from it between `<!-- roles:begin <id> -->` and `<!-- roles:end <id> -->`; a surface in `cite` mode
// names `modules/kernel/roles.yaml#<id>`. No surface of a role teaches a spelling the role's `contradicts` list names, and the
// contract is consistent: every reportsTo and overseenBy names a role, and the chain `reports` list follows reportsTo.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings } from '../lib/check-scan.mjs';
import { ROLES_FILE, markerOf, renderRoleBlock, rolesContract, withRoleBlock } from '../machine/roles-contract.mjs';

export const CODE = 'RT_ROLES_CONTRACT_DRIFT';
const REQUIRED = ['scope', 'does', 'cleanup', 'never', 'owns', 'decidesAlone', 'reportsUpWhen', 'measure', 'binds'];
const finding = (file, line, message) => ({ code: CODE, path: file, line, message: [line ? `${file}:${line}` : file, message].join(' ') });
const read = (root, file) => (fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : null);

function roleFindings(role, ids) {
  const named = [role.reportsTo, ...role.overseenBy, role.escalatesTo, ...(role.oversees ?? [])].filter(Boolean);
  const unknown = named.filter((id) => !ids.has(id)).map((id) => finding(ROLES_FILE, 0, `role ${role.id} names the unknown role ${id}`));
  const missing = REQUIRED.filter((field) => role[field] === undefined).map((field) => finding(ROLES_FILE, 0, `role ${role.id} lacks ${field}`));
  return [...unknown, ...missing];
}

/** The contradictions of the contract with itself: unknown ids and a chain that does not follow reportsTo. */
export function contractFindings(doc) {
  const ids = new Set(['runtime', ...doc.roles.map((role) => role.id)]);
  const byId = new Map(doc.roles.map((role) => [role.id, role]));
  const chain = doc.chain.reports.slice(0, -1).filter((id, index) => byId.get(id)?.reportsTo !== doc.chain.reports[index + 1])
    .map((id) => finding(ROLES_FILE, 0, `role ${id} must report to the next role of the chain`));
  return [...doc.roles.flatMap((role) => roleFindings(role, ids)), ...chain];
}

function surfaceFindings(root, role, surface, doc) {
  const text = read(root, surface.file);
  if (text === null) return [finding(surface.file, 0, `is a surface of role ${role.id} and does not exist`)];
  if (surface.mode === 'cite') return text.includes(`${ROLES_FILE}#${role.id}`) ? [] : [finding(surface.file, 0, `must cite ${ROLES_FILE}#${role.id}`)];
  const { begin, end } = markerOf(role.id);
  const from = text.indexOf(begin);
  const to = text.indexOf(end);
  if (from < 0 || to < from) return [finding(surface.file, 0, `lacks the generated ${role.id} block (run starci runtime check --only roles-contract -- --write)`)];
  const have = text.slice(from + begin.length + 1, to - 1);
  return have === renderRoleBlock(doc, role.id) ? [] : [finding(surface.file, 0, `carries a ${role.id} block that differs from ${ROLES_FILE} (run starci runtime check --only roles-contract -- --write)`)];
}

/** The lines of `text` outside the role's generated block, with their 1-based numbers. */
function proseLines(text, id) {
  const { begin, end } = markerOf(id);
  let inBlock = false;
  const out = [];
  text.split('\n').forEach((line, index) => {
    if (line.includes(begin)) inBlock = true;
    if (!inBlock) out.push({ line, number: index + 1 });
    if (line.includes(end)) inBlock = false;
  });
  return out;
}

function contradictionFindings(root, role) {
  const rules = role.contradicts.map((rule) => ({ ...rule, regex: new RegExp(rule.pattern, 'i') }));
  return role.surfaces.flatMap((surface) => {
    const text = read(root, surface.file);
    if (text === null) return [];
    return proseLines(text, role.id).flatMap(({ line, number }) => rules.filter((rule) => rule.regex.test(line))
      .map((rule) => finding(surface.file, number, `contradicts role ${role.id}: ${rule.why}`)));
  });
}

/** The RT_ROLES_CONTRACT_DRIFT findings over the tree at `root`. */
export function checkRolesContract(root = skillRoot) {
  const doc = rolesContract(root);
  const surfaces = doc.roles.flatMap((role) => role.surfaces.flatMap((surface) => surfaceFindings(root, role, surface, doc)));
  return [...contractFindings(doc), ...surfaces, ...doc.roles.flatMap((role) => contradictionFindings(root, role))];
}

/** Regenerates every block surface of the tree at `root`; returns how many it wrote. */
export function writeRoleBlocks(root = skillRoot) {
  const doc = rolesContract(root);
  const pairs = doc.roles.flatMap((role) => role.surfaces.filter((s) => s.mode === 'block').map((s) => [role.id, s.file]));
  for (const [id, file] of pairs) {
    const target = path.join(root, file);
    fs.writeFileSync(target, withRoleBlock(fs.readFileSync(target, 'utf8'), doc, id));
  }
  return pairs.length;
}

if (isMain(import.meta.url)) {
  if (process.argv.includes('--write')) console.log(`wrote ${writeRoleBlocks()} role block(s)`);
  else process.exitCode = printFindings(checkRolesContract(), 'OK: every role surface matches the roles contract.');
}
