// Current launch-root identity and owner-profile authorization. This module
// resolves authority only; the trust writer keeps all provider file effects.
import fs from 'node:fs';
import path from 'node:path';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { launchTrustSettings } from '../../engine/config.mjs';

/** The launch cwd as a directory, or null for an Orca selector ('active', 'id:…'). */
function launchDirectory(worktree) {
  if (typeof worktree !== 'string' || !worktree.trim()) return null;
  const p = worktree.startsWith('path:') ? worktree.slice(5) : worktree;
  try { return fs.statSync(p).isDirectory() ? path.resolve(p) : null; } catch { return null; }
}

/** Paths Codex keys trust by: the cwd, its git toplevel and the main worktree root. */
export function codexTrustPaths(cwd) {
  const out = [path.resolve(cwd)];
  const git = (...args) => {
    try {
      const r = revParseQuery(args, { dir: cwd, timeout: 10000 });
      return r.status === 0 ? r.stdout.trim() : null;
    } catch { return null; }
  };
  const top = git('--show-toplevel');
  if (top) out.push(path.resolve(top));
  const common = git('--path-format=absolute', '--git-common-dir');
  if (common && path.basename(common) === '.git') out.push(path.resolve(path.dirname(common)));
  const seen = new Set();
  return out.filter((p) => { const k = process.platform==='win32'?p.toLowerCase():p; if (seen.has(k)) { return false; } seen.add(k); return true; });
}

/** Resolve an existing checkout to exact current owner roots; never authorize by path prefix. */
export function launchTrustVerdict({cwd,config,platform=process.platform,roots=codexTrustPaths}={}){
  const dir=launchDirectory(cwd);
  if(!dir)return {ok:false,status:'declined',reason:'automatic trust requires a resolved existing launch directory'};
  let policy;try{policy=config===undefined?launchTrustSettings():launchTrustSettings(config);}catch(error){return {ok:false,status:'declined',reason:String(error.message)};}
  if(policy?.profile!=='automatic')return {ok:false,status:'declined',reason:policy?.profile==='declined'?'owner declined automatic launch trust':'current owner launchTrust profile is not adopted'};
  const key=p=>{const real=fs.realpathSync(p);return platform==='win32'?real.toLowerCase():real;};
  try{
    const paths=roots(dir);
    const approved=new Map(policy.roots.map(root=>[key(root),root]));
    // A worktree is authorized by its exact Git main root. A non-Git directory
    // needs its own exact root entry; a child of an approved directory is insufficient.
    const root=paths.at(-1);
    if(!root||!approved.has(key(root)))return {ok:false,status:'declined',reason:'launch repository is outside the exact owner-approved roots'};
    return {ok:true,dir,paths,approval:{approvedBy:policy.approvedBy,approvalRef:policy.approvalRef,root:approved.get(key(root))}};
  }catch(error){return {ok:false,status:'declined',reason:`cannot verify launch roots: ${error.message}`};}
}
