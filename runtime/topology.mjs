export const WORKTREE_ROOTS = Object.freeze(['_templates','businesses','uat','sessions','debts']);
export function canonicalRoots(root = '.worktrees') { return WORKTREE_ROOTS.map((name) => `${root}/${name}`); }
export function uatPair(root, feature, flow) { if (![feature,flow].every((x)=>/^[a-z0-9][a-z0-9._-]*$/.test(x))) throw new Error('invalid UAT identity'); const base=`${root}/uat/${feature}/${flow}`; return { snapshot:`${base}/snapshot.json`, result:`${base}/result.json` }; }
