// Host discovery projection owned by the runtime installer; no effects occur on import.
// Only exact recorded regular-file custody admits a copy update or retired entry removal.
import {sha256File} from '../../engine/digest.mjs';
import {cpSync, mkdirSync, readdirSync, rmSync, rmdirSync, lstatSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isLinkLike} from '../api/fs/is-link-like.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENTRY_SKILL = 'starci';
const HOST_SKILL_DIRS = ['.devin/skills', '.agents/skills'];
const RETIRED_SKILL = /^skills\/([a-z0-9-]+)\/SKILL\.md$/;

function entryPath(repo, relative) {
  if (path.isAbsolute(relative) || relative.includes('\\') || relative.includes(':')
    || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('invalid entry ownership path');
  let file = repo;
  for (const part of relative.split('/')) {
    file = path.join(file, part);
    if (isLinkLike(file)) throw new Error('entry ownership path contains a symlink/junction or redirect');
  }
  return file;
}

function entryInventory(directory, relative = '', files = {}) {
  const stat = lstatSync(directory, {throwIfNoEntry: false});
  if (!stat) return files;
  if (isLinkLike(directory, {stat}) || (!stat.isDirectory() && !stat.isFile())) throw new Error('entry skill contains an unowned link or special file');
  if (stat.isFile()) { files[relative] = sha256File(directory); return files; }
  for (const name of readdirSync(directory).sort()) entryInventory(path.join(directory, name), relative ? `${relative}/${name}` : name, files);
  return files;
}

function retiredEntryPlan(repo, dir, name, keptLocal, manifest, plan) {
  const relative = `${dir}/${name}`;
  let actual;
  try { actual = entryInventory(entryPath(repo, relative)); }
  catch (error) { plan.preserved.push({path: relative, reason: error.message}); return; }
  if (!Object.keys(actual).length) return;
  const prefix = `skills/${name}/`;
  if ([...keptLocal].some(file => file.startsWith(prefix))) {
    plan.preserved.push({path: relative, reason: 'prior runtime entry is marked keptLocal'});
    return;
  }
  const owned = Object.fromEntries(Object.entries(manifest.files).filter(([file]) => file.startsWith(prefix))
    .map(([file, digest]) => [file.slice(prefix.length), digest]));
  if (Object.keys(actual).length !== Object.keys(owned).length || Object.entries(actual).some(([file, digest]) => owned[file] !== digest)) {
    plan.preserved.push({path: relative, reason: 'entry differs from prior installer custody'});
    return;
  }
  for (const [file, digest] of Object.entries(actual)) plan.remove.push({relative: `${relative}/${file}`, digest, root: dir});
}

function currentEntryPlan(repo, dir, source, payload, keptLocal, manifest, plan) {
  const relative = `${dir}/${ENTRY_SKILL}`;
  let actual;
  try { actual = entryInventory(entryPath(repo, relative)); }
  catch (error) { plan.preserved.push({path: relative, reason: error.message}); return; }
  if ([...keptLocal].some(file => file.startsWith(`skills/${ENTRY_SKILL}/`))) {
    plan.preserved.push({path: relative, reason: 'prior runtime entry is marked keptLocal'});
    return;
  }
  const unowned = Object.entries(actual).some(([file, digest]) => !payload[file]
    || (digest !== payload[file] && digest !== manifest?.hostSkills?.files?.[`${relative}/${file}`]));
  if (unowned) { plan.preserved.push({path: relative, reason: 'entry contains locally changed or unowned files'}); return; }
  for (const [file, digest] of Object.entries(payload)) {
    const target = `${relative}/${file}`;
    plan.files[target] = digest;
    if (actual[file] !== digest) plan.write.push({relative: target, source: path.join(source, file), digest, previous: actual[file] ?? null});
  }
}

/** Plan host discovery changes from the installer's recorded file custody, before any writes. */
export function entrySkillsPlan(repo, manifest = null) {
  repo = path.resolve(repo);
  const source = path.join(packageRoot, 'skills', ENTRY_SKILL);
  const payload = entryInventory(source);
  if (!payload['SKILL.md']) throw new Error('package is incomplete: the StarCi entry is missing');
  const keptLocal = new Set(manifest?.keptLocal ?? []);
  const retired = [...new Set(Object.keys(manifest?.files ?? {}).map(file => RETIRED_SKILL.exec(file)?.[1])
    .filter(name => name && name !== ENTRY_SKILL))];
  const plan = {repo, write: [], remove: [], files: {}, preserved: [], skipped: []};
  for (const dir of HOST_SKILL_DIRS) {
    let dest;
    try { dest = entryPath(repo, dir); } catch (error) { plan.skipped.push({dir, reason: error.message}); continue; }
    const stat = lstatSync(dest, {throwIfNoEntry: false});
    if ((!stat && dir !== '.agents/skills') || (stat && !stat.isDirectory())) continue;
    for (const name of retired) retiredEntryPlan(repo, dir, name, keptLocal, manifest, plan);
    currentEntryPlan(repo, dir, source, payload, keptLocal, manifest, plan);
  }
  return plan;
}

function removeRetiredEntry(plan, item, log) {
  const file = entryPath(plan.repo, item.relative);
  if (!lstatSync(file, {throwIfNoEntry: false})?.isFile() || sha256File(file) !== item.digest) throw new Error('entry changed after cleanup planning');
  rmSync(file);
  let directory = path.dirname(file), boundary = path.join(plan.repo, item.root);
  while (directory !== boundary) {
    entryPath(plan.repo, path.relative(plan.repo, directory).split(path.sep).join('/'));
    try { rmdirSync(directory); }
    catch (error) { if (error.code === 'ENOTEMPTY' || error.code === 'EEXIST') break; throw error; }
    directory = path.dirname(directory);
  }
  log(`removed unchanged retired entry ${item.relative}`);
}

function writeCurrentEntry(plan, item) {
  const file = entryPath(plan.repo, item.relative);
  const stat = lstatSync(file, {throwIfNoEntry: false});
  if ((item.previous === null && stat) || (item.previous !== null && (!stat?.isFile() || sha256File(file) !== item.previous))) {
    throw new Error('entry changed after copy planning');
  }
  const sourceStat = lstatSync(item.source, {throwIfNoEntry: false});
  if (!sourceStat?.isFile() || isLinkLike(item.source, {stat: sourceStat}) || sha256File(item.source) !== item.digest) throw new Error('entry payload changed after copy planning');
  mkdirSync(path.dirname(file), {recursive: true});
  cpSync(item.source, file, {force: item.previous !== null, errorOnExist: item.previous === null});
  if (sha256File(file) !== item.digest) throw new Error('entry copy does not match its payload bytes');
}

/** Apply only the exact, unchanged host paths admitted by entrySkillsPlan. */
export function applyEntrySkillsPlan(plan, log = console.log) {
  for (const item of plan.remove) removeRetiredEntry(plan, item, log);
  for (const item of plan.write) writeCurrentEntry(plan, item);
  for (const item of plan.preserved) log(`preserved ${item.path}: ${item.reason}`);
  for (const item of plan.skipped) log(`left discovery root unchanged ${item.dir}: ${item.reason}`);
  return {hashMode: 'sha256-bytes', files: plan.files, preserved: plan.preserved, skipped: plan.skipped};
}
