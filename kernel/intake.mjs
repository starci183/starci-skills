import {describeNode,grammarReferences,plain,slash,unique,validateCommandAt} from './common.mjs';
import {decisionKindFor,intakeKindFor} from './io.mjs';

/**
 * The intake: the one operation that exists because the tree does NOT hold what the job is about.
 *
 * Every other operation of the kernel is derived from an authored node. An intake is derived from a scope entry
 * the tree does not know - a feature nobody has written down yet, or the brand of a product that has none - so
 * it is the only place the kernel writes records rather than work. That is why it is its own file: its goal,
 * its allowlist and its acceptance are the wording of a rule, they change with the rule, and they are re-read
 * from the current build on every tick (`retemplateIntakeOps`) rather than frozen at goal time.
 *
 * It is also where the reconciliation of a feature against the decided records lands (`settleIntake`): the
 * kernel checks the typed table mechanically before the validator ever sees the op, and every conflict row it
 * finds becomes the owner's question - never the runtime's decision.
 */

/** Whether a scope entry names this node: by id prefix or by tree path, the way the ledger's own scope filter reads it. */
export function scopeNames(node,entry){
  const key=slash(String(entry??'')).replace(/\/+$/,''),id=String(node?.id??''),where=slash(node?.path??'');
  return Boolean(key)&&(id===key||id.startsWith(`${key}.`)||where===key||where.startsWith(`${key}/`)||where.startsWith(`features/${key}/`));
}

/**
 * The intake operation of a scope entry the tree does not know. `brand` is authored and decided by one
 * `brand.decide` op on the one brand record; a feature is authored by one `work.author` op that mirrors the shape
 * of an existing feature - module record, business overview and SRS drafts, architecture skeleton - every record
 * `todo`, so the owner reads drafts and the decisions stay the owner's. Neither op closes a Work node: the records
 * it writes are the nodes the tree has afterwards.
 */
export function intakeOp(state,{workRoot,loaded,index,entry=null,repositories={},mode='author'}){
  const name=slash(String(entry??'')).replace(/\/+$/,'');
  const check={name:'work-tree-validates',command:validateCommandAt(workRoot)};
  if(name==='brand'){
    return {id:`brand-${index+1}`,kind:intakeKindFor('brand'),nodeId:null,intake:{scope:'brand'},
      goal:`Author and decide the brand record .starciwork/brand/index.yaml of this product from the job: ${state.job}. The name, the design family, every colour token with the role it plays and the source file it is traced to, the fonts, the mascot and logo assets (generate a placeholder mascot with the image model when the product has none), what is forbidden and the rules every imagery prompt must carry.`,
      ledgerIds:[],allowlist:['.starciwork/brand/index.yaml','.starciwork/brand/**'],
      // The frontend repository the tokens are traced to is a read-only reference here, never a place to write.
      references:unique(['workspace.yaml',...Object.entries(repositories).filter(([role])=>role!=='be').map(([,root])=>slash(root)),...grammarReferences()]),checks:[check],
      acceptance:['.starciwork/brand/index.yaml is a valid brand node: name, family, colour tokens with their roles and sources, the mascot and logo assets, the forbidden list and the imagery prompt rules','the Work tree still validates'],origin:'ledger'};
  }
  // The example the drafts mirror: the first feature module the tree already has, with its business and architecture roots.
  const paths=loaded.list.map(node=>slash(node.path??''));
  const features=unique(paths.map(where=>(where.match(/^features\/([^/]+)\//)??[])[1]).filter(Boolean)).sort();
  const example=features[0]?`features/${features[0]}`:null;
  const roots=example?[`${example}/index.yaml`,`${example}/business/index.yaml`,`${example}/business/overview/index.yaml`,`${example}/architecture/index.yaml`,`${example}/architecture/overview/index.yaml`]:[];
  const found=paths.filter(where=>roots.includes(where));
  // Always a real record to mirror: the module roots when the tree has them, else the first record under the example.
  const exampleRefs=found.length?found:paths.filter(where=>example&&where.startsWith(`${example}/`)).sort().slice(0,1);
  // The decided records of every other feature: the reconciliation reads them, references them, never restates them.
  const decided=loaded.list.filter(node=>node.state==='done'&&['business','business-overview','architecture'].includes(node.kind)&&!scopeNames(node,name)).map(node=>slash(node.path)).slice(0,60);
  const reconcile=mode==='reconcile';
  return {id:`${name.replace(/[^A-Za-z0-9._-]+/g,'-')}-intake`,kind:intakeKindFor(name),nodeId:null,intake:{scope:name,example,mode},
    goal:`${reconcile?`Reconcile and re-author the existing drafts of the feature ${name}`:`Author the Work records of the feature ${name}`} from the job: ${state.job}. A new feature is not appended beside the decided ones: read the decided SRS/SDS records it touches, reference what it shares, report as sds-gap what they must become, raise a real conflict as an open decision - so the tree reads as one consistent whole. Mirror the shape of the existing feature ${example??'(none yet)'}: the module record, the business overview and SRS as full drafts, the architecture as a skeleton; every leaf record todo (the module, business, srs, architecture and sds roots carry no state, exactly as the example), every open question an open decision.`,
    ledgerIds:[],allowlist:[`.starciwork/features/${name}/**`],
    references:unique(['workspace.yaml',...exampleRefs,...decided]),checks:[check],
    acceptance:[`features/${name} has a module record, a business overview, SRS records and an architecture skeleton, every leaf record todo and the whole feature valid - the roots (module, business, srs, architecture and sds) carry no state, as in the example feature`,
      `the module record of ${name} carries a reconciliation table over the decided records it touches (fit, change or conflict); what it shares is referenced by record id, never restated or redefined; a change a decided record needs was reported as sds-gap, never edited; a real conflict is an open decision record`,
      'no other feature\'s record changed by hand','the Work tree still validates'],origin:'ledger'};
}

/**
 * An intake op's goal and acceptance are the current build's words, not the ones frozen at goal time: the
 * validator reads the acceptance literally, so a wording the build has since corrected ("all todo" against a
 * tree whose roots carry no state) kept rejecting an op planned before the correction. Only the text moves;
 * the allowlist and the references the op was granted stay what the owner approved.
 */
export function retemplateIntakeOps(store,state,ctx,loaded){
  const workRoot=ctx.work?.at?.workRoot??null;
  if(!workRoot)return;
  for(const op of state.ops.filter(item=>item.intake?.scope&&!['done','blocked'].includes(item.status)||item.intake?.scope&&item.status==='blocked'&&!item.refusal)){
    let fresh=null;
    try{fresh=intakeOp(state,{workRoot,loaded,index:0,entry:op.intake.scope,repositories:{},mode:op.intake.mode??'author'});}catch{continue;}
    const changed=['goal','acceptance'].filter(key=>JSON.stringify(op[key])!==JSON.stringify(fresh[key]));
    if(!changed.length)continue;
    for(const key of changed)op[key]=fresh[key];
    store.appendEvent({event:'intake-retemplated',op:op.id,changed});
  }
}

/**
 * An intake op authored records, not a node: it is settled by what the tree holds under its scope now and is
 * never measured as an incomplete record (srs-sds and command-context finished blocked with their drafts
 * accepted, asking the owner about a node called null). The records are listed, the open decisions among them
 * are the owner's and go to the report, and nothing asks the user.
 *
 * The reconciliation of the feature against the decided records is checked here, before the validator, when the
 * kernel was given a checker (`ctx.reconcile`). A failing check is not an opinion: it names the rows that break
 * a rule, the report is downgraded to `failed` and the op runs again - which is why this returns the findings
 * instead of retrying itself. Retrying is the kernel's policy and stays there. A passing check puts every
 * `conflict` row to the owner exactly as an `owner.ask` decision is put, and the workflow finishes `blocked` on
 * those items rather than `done` over a conflict nobody settled.
 */
export function settleIntake(store,state,op,ctx){
  const scope=op.intake.scope;
  let loaded=null;
  try{loaded=ctx.work.api.loadLedger({...ctx.work.at,validate:ctx.work.validate});if(loaded.ok)ctx.work.loaded=loaded;}
  catch(error){store.appendEvent({event:'ledger-sync-failed',op:op.id,reason:error.message});}
  const tree=loaded?.ok?loaded:ctx.work.loaded;
  const reconciled=reconcileIntake(store,state,op,ctx,tree,scope);
  if(reconciled?.retry)return reconciled;
  const records=(tree?.list??[]).filter(node=>scopeNames(node,scope)).map(node=>node.id);
  try{
    state.decisions=(ctx.work.api.decisionCandidates?.(tree,{scope:state.scope.length?state.scope:null})??[]).map(node=>({id:node.id,kind:node.kind,path:node.path,
      operation:decisionKindFor(node.kind)??'business.decide',title:describeNode(ctx.work.api,ctx.work.at,node)}));
  }catch{/* the decisions the goal listed stand */}
  state.needUser=state.needUser.filter(item=>!(item.kind==='ledger'&&!item.node&&String(item.detail??'').includes(`after ${op.id} completed`)));
  store.appendEvent({event:'intake-authored',op:op.id,scope,records:records.length,decisions:state.decisions.map(item=>item.id)});
  return 'intake-authored';
}

/**
 * The mechanical half of the reconciliation. `ctx.reconcile` is `kernel/reconciliation.mjs` behind a seam, so a
 * kernel that was given none behaves exactly as it did before this rule existed; a kernel that has one gets a
 * verdict over the typed rows the intake wrote, which is a fact of the tree and needs no model at all.
 */
function reconcileIntake(store,state,op,ctx,tree,scope){
  if(typeof ctx.reconcile!=='function')return null;
  let result=null;
  try{result=ctx.reconcile({op,state,tree,scope});}
  catch(error){store.appendEvent({event:'reconciliation-failed',op:op.id,scope,reason:String(error?.message??error).slice(0,240)});return null;}
  if(!plain(result))return null;
  const findings=(Array.isArray(result.findings)?result.findings:[]).filter(plain)
    .map(item=>`${item.code}${item.record?` (${item.record})`:''}: ${item.detail??''}`.trim());
  if(result.ok===false){
    const last=op.reports.at(-1);
    if(last)last.downgradedTo='failed';
    store.appendEvent({event:'reconciliation-rejected',op:op.id,scope,findings:findings.slice(0,5)});
    return {retry:true,reason:'reconciliation-failed',
      findings:findings.length?findings:[`the reconciliation table of ${scope} does not hold against the decided records`]};
  }
  const counts=plain(result.counts)?result.counts:{};
  store.appendEvent({event:'reconciled',op:op.id,scope,...counts});
  for(const conflict of (Array.isArray(result.conflicts)?result.conflicts:[]).filter(plain)){
    // The owner settles a conflict, exactly as they settle an `owner.ask`: the same item shape, the same
    // command, the same answer path. The kernel never picks a side and never averages two decided records.
    if(state.needUser.some(item=>item.kind==='decision'&&item.op===op.id&&item.record===(conflict.decision??null)))continue;
    state.needUser.push({op:op.id,kind:'decision',
      detail:`${conflict.detail??`${conflict.record} conflicts with what ${scope} needs`} - answer with workflow-answer --id ${state.id} --op ${op.id} --choice <n> [--note "..."]`,
      record:conflict.decision??null,options:[...(conflict.options??[])],requesters:[op.id]});
    store.appendEvent({event:'reconciliation-conflict',op:op.id,record:conflict.record??null,decision:conflict.decision??null});
  }
  return null;
}
