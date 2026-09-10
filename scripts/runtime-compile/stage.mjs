import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { assertInside } from './paths.mjs';

/**
 * Publish a complete file map into `.dist` via staging.
 * Failed builds must not leave a partial “current” bundle.
 *
 * @param {string} skillRoot
 * @param {Map<string, Buffer>} files relative posix paths → bytes
 * @param {{ check?: boolean }} [options]
 */
export function publishDist(skillRoot, files, { check = false } = {}) {
  const dist = path.join(skillRoot, '.dist');
  const staging = path.join(skillRoot, `.dist.staging-${process.pid}-${crypto.randomUUID()}`);
  const previous = path.join(skillRoot, '.dist.previous');
  const lock = path.join(skillRoot, '.dist.publish-lock');
  const stale = [];

  for (const relative of files.keys()) {
    if (relative.includes('\\') || relative.split('/').includes('..') || path.isAbsolute(relative)) {
      throw Error(`Unsafe dist relative path: ${relative}`);
    }
  }

  if (check) {
    const release=acquirePublishLock(lock);try {
      if (fs.existsSync(dist) && fs.lstatSync(dist).isSymbolicLink()) throw Error('dist cannot be a symlink');
      const existing = listOwnedFiles(dist);
      for (const relative of existing) {
        if (!files.has(relative)) stale.push(relative);
      }
      for (const [relative, bytes] of files) {
        const file = path.join(dist, relative);
        if (!fs.existsSync(file) || !fs.readFileSync(file).equals(Buffer.from(bytes))) stale.push(relative);
      }
      return { ok: stale.length === 0, stale: [...new Set(stale)].sort((a, b) => a.localeCompare(b)), files: files.size };
    } finally {release();}
  }

  rmPath(staging);
  fs.mkdirSync(staging, { recursive: true });
  if (fs.lstatSync(staging).isSymbolicLink()) throw Error('staging cannot be a symlink');

  for (const [relative, bytes] of [...files].sort((a, b) => a[0].localeCompare(b[0]))) {
    const file = path.join(staging, relative);
    let cursor = staging;
    for (const segment of relative.split('/')) {
      cursor = path.join(cursor, segment);
      if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) {
        throw Error('Build target cannot be a symlink');
      }
    }
    assertInside(staging, file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
  }

  // Verify staging completeness before swapping.
  for (const [relative, bytes] of files) {
    const file = path.join(staging, relative);
    if (!fs.existsSync(file) || !fs.readFileSync(file).equals(Buffer.from(bytes))) {
      rmPath(staging);
      throw Error(`Staging verification failed for ${relative}`);
    }
  }

  const release=acquirePublishLock(lock);
  try {
    // Concurrent package/build tests commonly publish identical bytes. Avoid
    // renaming a live Windows directory while other readers have files open.
    if (matchesFileMap(dist,files)) return { ok: true, stale: [], files: files.size };
    rmPath(previous);
    if (fs.existsSync(dist)) {
      if (fs.lstatSync(dist).isSymbolicLink()) throw Error('dist cannot be a symlink');
      fs.renameSync(dist, previous);
    }
    try {
      fs.renameSync(staging, dist);
    } catch (error) {
      if (fs.existsSync(previous) && !fs.existsSync(dist)) {
        try { fs.renameSync(previous, dist); } catch { /* best-effort restore */ }
      }
      throw error;
    }
    rmPath(previous);
  } finally {
    release();
    rmPath(staging);
  }
  return { ok: true, stale: [], files: files.size };
}

/** Atomically claim publication. Existing locks are never reclaimed here: an
 * operator must stop all publishers, inspect the reported owner/token, and
 * remove that exact lock and claim offline. This avoids deleting a successor's
 * live lock during concurrent stale-owner recovery. */
export function acquirePublishLock(lock,{timeoutMs=30000}={}) {
  const token=crypto.randomUUID(),claim=`${lock}.claim-${process.pid}-${token}`,startedAt=Date.now(),deadline=startedAt+timeoutMs;
  fs.writeFileSync(claim,JSON.stringify({schema:'starci/dist-publish-lock@1',pid:process.pid,token,startedAt,claim}),{flag:'wx'});
  while(true){
    try{fs.linkSync(claim,lock);break;}
    catch(error){
      if(error.code!=='EEXIST'){try{fs.unlinkSync(claim);}catch{}throw error;}
      let owner=null;try{owner=JSON.parse(fs.readFileSync(lock,'utf8'));}catch{/* Ambiguous locks are preserved. */}
      const complete=owner?.schema==='starci/dist-publish-lock@1'&&Number.isInteger(owner.pid)&&typeof owner.token==='string'&&Number.isFinite(owner.startedAt)&&typeof owner.claim==='string';
      if(Date.now()>=deadline){
        try{fs.unlinkSync(claim);}catch{}
        const detail=complete?`owner PID ${owner.pid}, token ${owner.token}, claim ${owner.claim}`:'malformed or ambiguous owner metadata';
        throw Error(`Timed out waiting for dist publish lock (${detail}). Stop all publishers, verify the recorded owner/token is no longer active, then remove this exact lock and claim offline before retrying.`);
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,25);
    }
  }
  return ()=>{try{const owner=JSON.parse(fs.readFileSync(lock,'utf8'));if(owner.token===token&&owner.pid===process.pid)fs.unlinkSync(lock);}catch{}try{fs.unlinkSync(claim);}catch{}};
}

function listOwnedFiles(distRoot) {
  const out = [];
  if (!fs.existsSync(distRoot)) return out;
  if (fs.lstatSync(distRoot).isSymbolicLink()) throw Error('dist cannot be a symlink');
  const visit = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw Error(`Build target cannot be a symlink: ${file}`);
      if (entry.isDirectory()) visit(file);
      else out.push(path.relative(distRoot, file).replaceAll('\\', '/'));
    }
  };
  visit(distRoot);
  return out.sort((a, b) => a.localeCompare(b));
}

function matchesFileMap(distRoot,files){
  if(!fs.existsSync(distRoot)||fs.lstatSync(distRoot).isSymbolicLink())return false;
  const existing=listOwnedFiles(distRoot);if(existing.length!==files.size)return false;
  return existing.every(relative=>files.has(relative)&&fs.readFileSync(path.join(distRoot,relative)).equals(Buffer.from(files.get(relative))));
}

function rmPath(target) {
  if (!fs.existsSync(target)) return;
  if (fs.lstatSync(target).isSymbolicLink()) throw Error(`Refusing to remove symlink: ${target}`);
  fs.rmSync(target, { recursive: true, force: false });
}
