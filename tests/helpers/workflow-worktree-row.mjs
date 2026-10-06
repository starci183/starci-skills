import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {registerWorkflowWorktree} from '../../scripts/kernel/workflow-worktree.mjs';
import {workflowWorktreeOf} from '../../scripts/machine/workflow-tree.mjs';

/**
 * The registry row Kernel start writes for a workflow: the repository checkout (a real Git repository with a commit, see
 * proofRepo in sonar-scan.mjs) is the workflow's registered worktree on its current branch, the placement the spec's ops
 * already use. It is registered through the owner API into the machine registry `env` selects (the spec's own by default),
 * once per workflow.
 */
export const registerRepoWorkflowWorktree=({repo,workflowId,env=process.env})=>{
  const held=workflowWorktreeOf({env},workflowId);
  if(held)return held;
  const head=spawnSync('git',['-C',repo,'rev-parse','--abbrev-ref','HEAD'],{encoding:'utf8',windowsHide:true});
  if(head.status!==0)throw new Error(`${repo} is not a Git checkout with a commit: ${head.stderr}`);
  return registerWorkflowWorktree({env},{workflowId,orcaWorktreeId:`spec::${workflowId}`,path:repo,branch:head.stdout.trim()});
};

/**
 * A workflow of its own worktree, as Kernel start leaves it: a linked checkout `<repo>-<workflowId>` on branch
 * `wf-<workflowId>` cut from main, registered through the owner API. For specs whose workflows must not share one path.
 */
export const addWorkflowWorktree=({repo,workflowId,env=process.env})=>{
  const held=workflowWorktreeOf({env},workflowId);
  if(held)return held;
  const tree=path.join(path.dirname(repo),`${path.basename(repo)}-${workflowId}`),branch=`wf-${workflowId}`;
  const added=spawnSync('git',['-C',repo,'worktree','add','-q','-b',branch,tree,'main'],{encoding:'utf8',windowsHide:true});
  if(added.status!==0)throw new Error(`git worktree add ${tree}: ${added.stderr}`);
  return registerWorkflowWorktree({env},{workflowId,orcaWorktreeId:`spec::${workflowId}`,path:tree,branch});
};
