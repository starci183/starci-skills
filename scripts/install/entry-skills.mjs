// Host discovery projection owned by the runtime installer; no effects occur on import.
// Only exact recorded regular-file custody admits a copy update or retired entry removal.
import {sha256, sha256File} from '../../engine/digest.mjs';
import {cpSync, mkdirSync, readdirSync, readFileSync, rmSync, rmdirSync, lstatSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isLinkLike} from '../api/fs/is-link-like.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// Prior runtime manifests normalized line endings; new discovery custody binds exact copied bytes.
const legacySha = file => sha256(readFileSync(file).toString('utf8').replace(/\r\n/g, '\n'));

const ENTRY_SKILL = 'starci';
const HOST_SKILL_DIRS = ['.devin/skills', '.agents/skills'];

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

function entryInventory(directory, relative = '', files = {}, digest = sha256File) {
  const stat = lstatSync(directory, {throwIfNoEntry: false});
  if (!stat) return files;
  if (isLinkLike(directory, {stat}) || (!stat.isDirectory() && !stat.isFile())) throw new Error('entry skill contains an unowned link or special file');
  if (stat.isFile()) { files[relative] = digest(directory); return files; }
  for (const name of readdirSync(directory).sort()) entryInventory(path.join(directory, name), relative ? `${relative}/${name}` : name, files, digest);
  return files;
}

/** Plan host discovery changes from the installer's recorded file custody, before any writes. */
export function entrySkillsPlan(repo, manifest = null) {
  repo = path.resolve(repo);
  const source = path.join(packageRoot, 'skills', ENTRY_SKILL);
  const payload = entryInventory(source);
  if (!payload['SKILL.md']) throw new Error('package is incomplete: the StarCi entry is missing');
  const keptLocal = new Set(manifest?.keptLocal ?? []);
  const retired = [...new Set(Object.keys(manifest?.files ?? {}).map(file => file.match(/^skills\/([a-z0-9-]+)\/SKILL\.md$/)?.[1])
    .filter(name => name && name !== ENTRY_SKILL))];
  const plan = {repo, write: [], remove: [], files: {}, preserved: [], skipped: []};
  for (const dir of HOST_SKILL_DIRS) {
    let dest;
    try { dest = entryPath(repo, dir); } catch (error) { plan.skipped.push({dir, reason: error.message}); continue; }
    const stat = lstatSync(dest, {throwIfNoEntry: false});
    if ((!stat && dir !== '.agents/skills') || (stat && !stat.isDirectory())) continue;
    for (const name of retired) {
      const relative = `${dir}/${name}`;
      let actual;
      try { actual = entryInventory(entryPath(repo, relative)); }
      catch (error) { plan.preserved.push({path: relative, reason: error.message}); continue; }
      if (!Object.keys(actual).length) continue;
      const prefix = `skills/${name}/`;
      if ([...keptLocal].some(file => file.startsWith(prefix))) {
        plan.preserved.push({path: relative, reason: 'prior runtime entry is marked keptLocal'});
        continue;
      }
      const owned = Object.fromEntries(Object.entries(manifest.files).filter(([file]) => file.startsWith(prefix))
        .map(([file, digest]) => [file.slice(prefix.length), digest]));
      const prior = entryInventory(entryPath(repo, relative), '', {}, legacySha);
      if (Object.keys(actual).length !== Object.keys(owned).length || Object.entries(prior).some(([file, digest]) => owned[file] !== digest)) {
        plan.preserved.push({path: relative, reason: 'entry differs from prior installer custody'});
        continue;
      }
      for (const [file, digest] of Object.entries(actual)) plan.remove.push({relative: `${relative}/${file}`, digest, root: dir});
    }
    const relative = `${dir}/${ENTRY_SKILL}`;
    let actual;
    try { actual = entryInventory(entryPath(repo, relative)); }
    catch (error) { plan.preserved.push({path: relative, reason: error.message}); continue; }
    if ([...keptLocal].some(file => file.startsWith(`skills/${ENTRY_SKILL}/`))) {
      plan.preserved.push({path: relative, reason: 'prior runtime entry is marked keptLocal'});
      continue;
    }
    const unowned = Object.entries(actual).some(([file, digest]) => !payload[file]
      || (digest !== payload[file] && digest !== manifest?.hostSkills?.files?.[`${relative}/${file}`]
        && legacySha(entryPath(repo, `${relative}/${file}`)) !== manifest?.files?.[`skills/${ENTRY_SKILL}/${file}`]));
    if (unowned) { plan.preserved.push({path: relative, reason: 'entry contains locally changed or unowned files'}); continue; }
    for (const [file, digest] of Object.entries(payload)) {
      const target = `${relative}/${file}`;
      plan.files[target] = digest;
      if (actual[file] !== digest) plan.write.push({relative: target, source: path.join(source, file), digest, previous: actual[file] ?? null});
    }
  }
  return plan;
}

/** Apply only the exact, unchanged host paths admitted by entrySkillsPlan. */
export function applyEntrySkillsPlan(plan, log = console.log) {
  for (const item of plan.remove) {
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
  for (const item of plan.write) {
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
  for (const item of plan.preserved) log(`preserved ${item.path}: ${item.reason}`);
  for (const item of plan.skipped) log(`left discovery root unchanged ${item.dir}: ${item.reason}`);
  return {hashMode: 'sha256-bytes', files: plan.files, preserved: plan.preserved, skipped: plan.skipped};
}
