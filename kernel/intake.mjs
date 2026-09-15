import {describeNode,grammarReferences,plain,slash,unique,validateCommandAt} from './common.mjs';
import {decisionKindFor,intakeKindFor} from './io.mjs';
import {openConflictDecision} from './owner.mjs';

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
 * A scope entry read as the feature tree reads it: which feature it names and which layers of that feature it
 * reaches. `login`, `features/login` and `.starciwork/features/login/business` are three spellings of the same
 * tree, and the ledger's own scope filter accepts all three - so the intake must too, or a caller who wrote the
 * path out in full got an operation over `features/features/login/business`, a feature nobody has or wants.
 * An entry that is not a path into the feature tree (a node id, `brand`) has no feature and is left alone.
 */
export function featureScope(entry){
  const key=slash(String(entry??'')).replace(/^\.\//,'').replace(/^\/+/,'').replace(/\/+$/,'').replace(/^\.starciwork\//,'');
  if(!key||key.includes('.'))return null;
  const parts=key.replace(/^features\//,'').split('/').filter(Boolean);
  if(!parts.length)return null;
  return {feature:parts[0],layers:parts.slice(1),name:parts.join('/')};
}

/**
 * The layers of one feature that a set of scope entries actually reaches. An empty answer means the whole
 * feature: either the scope named it whole, or the scope says nothing about it at all.
 */
export function scopedLayers(feature,scope=[]){
  const named=(scope??[]).map(entry=>featureScope(entry)).filter(item=>item&&item.feature===feature);
  if(!named.length||named.some(item=>!item.layers.length))return [];
  return unique(named.map(item=>item.layers[0]));
}

/**
 * The intake scopes of a goal, normalized and narrowed.
 *
 * Two things went wrong before this existed. A fully spelled entry produced a fake feature (above), and a
 * `--reintake <feature>` beside a scope that named only two layers of it produced an operation holding the whole
 * feature - ui, implementation, uat and all - because the reintake entry was taken as its own scope instead of
 * being read against the one the owner approved. Both are the same mistake: the entry was used as a string
 * rather than resolved against the tree and intersected with the scope. A layer entry whose feature is also
 * named whole is dropped here, because the broader operation already covers it and two operations over nested
 * allowlists may never run together.
 */
export function narrowIntakeScopes(entries){
  const parsed=(entries??[]).map(entry=>({entry:slash(String(entry??'')).replace(/\/+$/,''),scoped:featureScope(entry)})).filter(item=>item.entry);
  const whole=new Set(parsed.filter(item=>item.scoped&&!item.scoped.layers.length).map(item=>item.scoped.feature));
  const out=[];
  for(const item of parsed){
    if(!item.scoped){if(!out.includes(item.entry))out.push(item.entry);continue;}
    if(item.scoped.layers.length&&whole.has(item.scoped.feature))continue;
    if(!out.includes(item.scoped.name))out.push(item.scoped.name);
  }
  return out;
}

/**
 * What one intake may write: the layers of its feature the scope reaches, plus that feature's own module record
 * - the file its reconciliation table is written into, so an intake restricted to two layers is still able to
 * satisfy its own acceptance. Never the feature catalog `features/index.yaml`, and never a layer outside the
 * scope: a goal that approved business and architecture did not approve ui, implementation, uat or integration.
 */
export function intakeAllowlist(feature,layers=[]){
  return layers.length
    ?layers.map(layer=>`.starciwork/features/${feature}/${layer}/**`)
    :[`.starciwork/features/${feature}/**`];
}

/** The record the reconciliation table is written into: the module record, or the shallowest record a layer-restricted intake owns. */
export function reconciliationCarrier(feature,layers=[]){
  return layers.length?`the record features/${feature}/${layers[0]}/index.yaml`:'the module record';
}

/**
 * The intake operation of a scope entry the tree does not know. `brand` is authored and decided by one
 * `brand.decide` op on the one brand record; a feature is authored by one `work.author` op that mirrors the shape
 * of an existing feature - module record, business overview and SRS drafts, architecture skeleton - every record
 * `todo`, so the owner reads drafts and the decisions stay the owner's. Neither op closes a Work node: the records
 * it writes are the nodes the tree has afterwards.
 */
export function intakeOp(state,{workRoot,loaded,index,entry=null,repositories={},mode='author',scope=[],layers=null}){
  const scoped=featureScope(entry);
  // The entry resolved against the tree, not the string the caller happened to spell: the feature it names,
  // and the layers of that feature this operation owns - its own when the entry names one, else the ones the
  // approved scope reaches. An empty list is the whole feature, which is what an unscoped intake always was.
  const name=scoped?scoped.name:slash(String(entry??'')).replace(/\/+$/,'');
  const feature=scoped?scoped.feature:name;
  const owned=Array.isArray(layers)?layers.filter(Boolean):(scoped?(scoped.layers.length?scoped.layers:scopedLayers(scoped.feature,scope)):[]);
  const ownedText=owned.map(layer=>`features/${feature}/${layer}`).join(' and ');
  const carrier=reconciliationCarrier(feature,owned);
  const onlyOwned=owned.length?` This operation owns ${ownedText} alone: the module record features/${feature}/index.yaml and every other layer of ${feature} are outside the approved scope and are never written. The reconciliation table goes into the shallowest record this operation owns, features/${feature}/${owned[0]}/index.yaml; a change the module record would need is recorded there as an integration request naming the canonical index path, its current owner and the requested reference/conflict/new change.`:'';
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
  const id=`${name.replace(/[^A-Za-z0-9._-]+/g,'-')}-intake`;
  // Migrate mode: the records exist and are decided; what the current model makes explicit is added beside them.
  if(mode==='migrate'){
    return {id,kind:intakeKindFor(name),nodeId:null,intake:{scope:name,feature,layers:[],example,mode},
      goal:`Bring the decided records of the feature ${name} under the current Work model without re-deciding any of them: ${state.job}. Read every decided SRS/SDS record of the other features this feature touches and write one typed row per record into the module record at extensions.work3.reconciliation ({case, record, decision, reads, hands, detail}) - reference what a decided record already holds and cite it by id, conflict what cannot hold together with it and write a todo decision record under this feature with both sides, the options and one recommendation for the owner, new what no decided record covers, declaring what it reads and what it hands on. Declare every outside system the architecture of ${name} talks to (a messaging provider, a payment gateway, a mail or storage service, an identity provider) at extensions.work3.integrations on the module record, one entry {id, provider, credential: {name, providedBy: owner, custody: identity:<slug>}} naming the exact variable and the encrypted identity resource that holds it, and author one todo integration node features/${name}/integration/<id>/index.yaml per entry; never write a secret value anywhere. A decided record keeps its state, its rev and its wording: what contradicts it is a conflict row and a decision record, never an edit. Touch nothing under implementation/ or ui/.`,
      ledgerIds:[],allowlist:[`.starciwork/features/${feature}/index.yaml`,`.starciwork/features/${feature}/business/**`,`.starciwork/features/${feature}/architecture/**`,`.starciwork/features/${feature}/integration/**`],
      references:unique(['workspace.yaml',`features/${name}/index.yaml`,...decided]),checks:[check],
      acceptance:[`the module record of ${name} carries extensions.work3.reconciliation: one row {case, record, decision, reads, hands, detail} per decided record of another feature it touches, its case one of reference, conflict or new; every reference row cites a decided record by id and nothing under ${name} restates it; every conflict row names a todo decision record of ${name} stating both sides, the consequences, the numbered options and one recommendation; every new row names a record under ${name} and declares its reads and hands`,
        `every outside system the architecture of ${name} talks to is declared at extensions.work3.integrations on the module record with its id, its provider and a credential {name, providedBy: owner, custody: identity:<slug>}, one todo integration node features/${name}/integration/<id>/index.yaml exists per entry, and no secret value appears in any record`,
        `no decided record of ${name} changed its state, its rev or its substance, and nothing under features/${name}/implementation or features/${name}/ui changed`,
        'no other feature\'s record changed by hand','the Work tree still validates'],origin:'ledger'};
  }
  return {id,kind:intakeKindFor(name),nodeId:null,intake:{scope:name,feature,layers:[...owned],example,mode},
    goal:`${reconcile?`Reconcile and re-author the existing drafts of the feature ${feature}`:`Author the Work records of the feature ${feature}`} from the job: ${state.job}.${onlyOwned} A new feature is not appended beside the decided ones: read the decided SRS/SDS records it touches and write one typed row per record into ${carrier} at extensions.work3.reconciliation ({case, record, decision, reads, hands, detail}) - reference what a decided record already holds and cite it by id, conflict what cannot hold together with it and write a todo decision record under this feature with both sides, the options and one recommendation for the owner, new what no decided record covers, declaring what it reads and what it hands on. No record of another feature is edited and none is reported against. Mirror the shape of the existing feature ${example??'(none yet)'}: the module record, the business overview and SRS as full drafts, the architecture as a skeleton; every leaf record todo (the module, business, srs, architecture and sds roots carry no state, exactly as the example), every open question an open decision.`,
    ledgerIds:[],allowlist:intakeAllowlist(feature,owned),
    references:unique(['workspace.yaml',...exampleRefs,...decided]),checks:[check],
    acceptance:[owned.length
      ?`${ownedText} hold the records this goal approved, every leaf record todo and the feature valid - the roots (module, business, srs, architecture and sds) carry no state, as in the example feature`
      :`features/${feature} has a module record, a business overview, SRS records and an architecture skeleton, every leaf record todo and the whole feature valid - the roots (module, business, srs, architecture and sds) carry no state, as in the example feature`,
      ...(owned.length?[`nothing outside ${ownedText} changed: the module record features/${feature}/index.yaml and the layers of ${feature} this goal did not approve are untouched`]:[]),
      `${carrier} of ${feature} carries extensions.work3.reconciliation: one row {case, record, decision, reads, hands, detail} per decided record it touches, its case one of reference, conflict or new; every reference row cites a decided record by id and nothing under ${feature} restates it; every conflict row names a todo decision record of ${feature} stating both sides, the consequences, the numbered options and one recommendation; every new row names a record under ${feature} and declares its reads and hands; no record of another feature changed`,
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
    // The layers the op was granted travel with it: retemplating rewords an operation, it never re-scopes one,
    // so a goal that approved two layers of a feature keeps saying two layers after the build's words move.
    try{fresh=intakeOp(state,{workRoot,loaded,index:0,entry:op.intake.scope,repositories:{},mode:op.intake.mode??'author',
      layers:Array.isArray(op.intake.layers)?op.intake.layers:null});}catch{continue;}
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
 * `conflict` row to the owner exactly as a `decision.prepare` decision is put, and the workflow finishes `blocked` on
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
    // A conflict is a decision like every other: the runtime takes the recommendation the intake wrote into the
    // decision record, provisionally, through one detached decision.prepare, and the owner overturns it later.
    // The kernel never picks a side itself and never averages two decided records; the work is not held.
    const ask=openConflictDecision(store,state,op,conflict,ctx);
    store.appendEvent({event:'reconciliation-conflict',op:op.id,record:conflict.record??null,decision:conflict.decision??null,ask:ask?.id??null,provisional:Boolean(ask)});
  }
  return null;
}
