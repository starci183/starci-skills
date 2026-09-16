import fs from 'node:fs';
import path from 'node:path';

/**
 * The debug trace of goal.md §7: with `debug: true` in config.json every dispatch, settle, block and defer
 * the kernel takes also lands as one human-readable line in `trace.log`, beside `events.jsonl` in the
 * workflow's `_local/workflows/<id>/` directory. The event stream stays the audit; this file is the owner's
 * read of why the kernel did what it did - which op was picked, the gap and the requires state that picked
 * it, the exact inputs it was handed (file@digest), the model it went to and the reason, what the op
 * returned, and the route a blocker took.
 *
 * Everything on a line comes from journal facts the kernel already records: the tracer renders, it never
 * decides. The four renderers are pure - same payload, same line, no clock, no environment - and `emit`
 * only formats and appends. Debug off is a no-op object: no file is created and the event stream is
 * exactly what it was.
 */
export const TRACE_SCHEMA='starci/kernel-trace@1';
export const TRACE_KINDS=Object.freeze(['pick','settle','block','defer']);

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
/** One bounded, single-line, secret-free rendering of a journal field. Same shape as progress.mjs's clip. */
const clip=(value,max=200)=>String(value??'').replace(/\s+/g,' ').replace(/(bearer\s+)[^\s]+/ig,'$1[redacted]')
  .replace(/\b([A-Za-z0-9_]*(?:TOKEN|PASSWORD|SECRET|CREDENTIAL|API_KEY|ACCESS_KEY)[A-Za-z0-9_]*)\b["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^,;]+)/ig,'$1=[redacted]').slice(0,max).trim();
const opId=payload=>{need(plain(payload)&&typeof payload.op==='string'&&payload.op.trim(),'A trace line needs its operation id');return clip(payload.op,80);};
/** A sha short enough to read aloud; the full digest stays in the journal row the line came from. */
const shortDigest=value=>{const text=clip(value,80);return text.length>12?text.slice(0,12):text;};
/** `45min`, `2h 5min`, `800ms` - durations an owner can scan without arithmetic. */
const prettyMs=ms=>{if(!Number.isFinite(ms))return String(ms);if(ms<60000)return `${Math.round(ms)}ms`;const minutes=Math.round(ms/60000),hours=Math.floor(minutes/60);return hours?`${hours}h${minutes%60?` ${minutes%60}min`:''}`:`${minutes}min`;};
const fieldValue=(key,value)=>/ms$/i.test(key)&&Number.isFinite(value)?prettyMs(value):plain(value)||Array.isArray(value)?clip(JSON.stringify(value),80):clip(value,80);

/** The gap an op answers: a node, the ledger ids it joins, or a one-line goal. */
function gapOf(payload){
  const gap=Array.isArray(payload.gap)?payload.gap.map(item=>clip(item,80)).filter(Boolean).join('+'):clip(payload.gap,140);
  const kind=clip(payload.kind,60);
  if(gap&&kind)return `${kind} ${gap}`;
  return gap||kind||'-';
}

/** The requires state that made the op eligible: `srs:settled sds:open`, from strings, pairs or a map. */
function requiresOf(requires){
  const list=Array.isArray(requires)?requires:plain(requires)?Object.entries(requires).map(([name,state])=>({name,state})):requires===null||requires===undefined?[]:[requires];
  return list.map(item=>{
    if(plain(item)){const name=item.name??item.record??item.kind,state=item.state??item.status??item.readiness;return `${clip(name,60)}${state===null||state===undefined?'':`:${clip(state,40)}`}`;}
    return clip(item,80);
  }).filter(Boolean).join(' ');
}

/** Exact inputs the op was handed: `file@digest` pairs from objects, `{file:digest}` maps or strings. */
function inputsOf(inputs){
  const list=Array.isArray(inputs)?inputs:plain(inputs)?Object.entries(inputs).map(([file,digest])=>({file,digest})):inputs===null||inputs===undefined?[]:[inputs];
  const rendered=list.map(item=>{
    if(plain(item)){
      const file=item.file??item.path??item.ref??item.name,digest=item.digest??item.sha256??item.sha??item.inputDigest;
      return `${clip(file,140)}${digest===null||digest===undefined||digest===''?'':`@${shortDigest(digest)}`}`;
    }
    return clip(item,160);
  }).filter(Boolean);
  return rendered.length?rendered.join(','):'-';
}

/** `runtime/model` - the pool and the pinned target inside it. */
function modelOf(payload){
  const model=payload.model;
  if(typeof model==='string'&&model.trim())return clip(model,120);
  const pair=plain(model)?[model.runtime??model.pool,model.model??model.target]:[payload.runtime,payload.modelId??payload.target];
  return clip(pair.filter(Boolean).join('/'),120)||'-';
}

/** The metric delta a settle moved: `{from,to}` renders `5→4`; an object renders `key=value` pairs. */
function deltaOf(delta){
  if(delta===null||delta===undefined||delta==='')return '-';
  if(typeof delta==='string'||Number.isFinite(delta))return clip(delta,120);
  if(!plain(delta))return clip(delta,120);
  if(delta.from!==undefined&&delta.to!==undefined)return `${clip(delta.from,60)}→${clip(delta.to,60)}`;
  const parts=Object.entries(delta).filter(([key,value])=>key!=='summary'&&value!==null&&value!==undefined&&value!==''&&!Number.isNaN(value))
    .map(([key,value])=>`${key}=${fieldValue(key,value)}`);
  return parts.length?parts.join(' '):'-';
}

/**
 * A dispatch decision: which op, the gap + requires state that picked it, its exact inputs, the
 * `runtime/model` it launched on and why that runtime won.
 */
export function renderPick(payload={}){
  const requires=requiresOf(payload.requires);
  return `[pick]   op=${opId(payload)} vì=${gapOf(payload)}${requires?` (requires ${requires})`:''} input=${inputsOf(payload.inputs)} model=${modelOf(payload)} — ${clip(payload.reason,200)||'-'}`;
}

/** An accepted report: which op, what it returned, and the metric delta its acceptance moved. */
export function renderSettle(payload={}){
  return `[settle] op=${opId(payload)} output=${clip(payload.output??payload.summary,200)||'-'} → ${deltaOf(payload.delta)}`;
}

/** A blocker classification: which op, the kind it reported, its detail, and the route it took. */
export function renderBlock(payload={}){
  const route=plain(payload.route)?[payload.route.kind??payload.route.id??'-',payload.route.then?`then ${payload.route.then}`:null].filter(Boolean).join(' '):clip(payload.route,120);
  const bounds=Number.isFinite(payload.attempt)||Number.isFinite(payload.limit)?` (${Number.isFinite(payload.attempt)?payload.attempt:'?'}/${Number.isFinite(payload.limit)?payload.limit:'-'})`:'';
  return `[block]  ${opId(payload)}: ${clip(payload.kind,60)||'-'} "${clip(payload.detail,220)}" → route ${route||'-'}${bounds}`;
}

/** A capacity deferral: which op waited, and the reason it could not launch this tick. */
export function renderDefer(payload={}){
  const waiting=payload.waitingFor?` (waiting on ${clip(payload.waitingFor,80)})`:'';
  return `[defer]  ${opId(payload)}: ${clip(payload.reason,220)||'-'}${waiting}`;
}

const RENDERERS={pick:renderPick,settle:renderSettle,block:renderBlock,defer:renderDefer};

/**
 * The tracer the kernel is handed. `debug` off - or absent - returns a no-op object that creates nothing
 * and never touches the disk. On, it needs the file it appends to: `traceFile` is the workflow's own
 * `trace.log`, resolved once, its directory created lazily at the first line. `emit` formats one line with
 * the renderer of its kind and appends it; an unknown kind is a wiring error, so it throws rather than
 * silently dropping a decision the owner asked to see.
 */
export function createTracer({debug=false,traceFile=null}={}){
  if(debug!==true)return {schema:TRACE_SCHEMA,enabled:false,traceFile:null,emit(){return null;}};
  need(typeof traceFile==='string'&&traceFile.trim(),'createTracer needs a traceFile when debug is on');
  const file=path.resolve(traceFile);
  return {schema:TRACE_SCHEMA,enabled:true,traceFile:file,
    emit(kind,payload){
      const render=RENDERERS[kind];
      need(typeof render==='function',`Unknown trace kind ${kind}`);
      const line=render(payload);
      fs.mkdirSync(path.dirname(file),{recursive:true});
      fs.appendFileSync(file,`${line}\n`);
      return line;
    }};
}

/* ------------------------------------------------------------------------ SEAM.md
 * The kernel.mjs wiring this module is built for (a follow-up merge; kernel.mjs is not edited here).
 * One tracer per workflow, carried on `ctx` so every site below reaches it:
 *
 *   kernel.mjs `runLoop` (~line 3781), in the `ctx` literal:
 *     trace: createTracer({debug:configuredProgressDebug(),traceFile:path.join(store.dir,'trace.log')})
 *   `configuredProgressDebug` (kernel/progress.mjs) already reads `debug` from config.json, and `store.dir`
 *   is `_local/workflows/<id>/` - so trace.log lands beside events.jsonl exactly as §7 requires.
 *
 * Every payload below is copied from the journal event the site already appends: the trace renders the
 * same facts, it is never a second source of truth. A site that appends no event writes no line.
 *
 *   pick — `scheduleOps` (~line 1231): right after
 *     `const result=launchOp(orca,store,state,op,{...allocated,candidate},ctx)` returns `result.ok`,
 *     while `allocated` is still in scope (equivalently inside `launchOp` beside the `launched` event
 *     ~line 801, which is the same fact):
 *       ctx.trace.emit('pick',{op:op.id,kind:op.kind,
 *         gap:op.nodeId??(op.ledgerIds?.length?op.ledgerIds.join('+'):firstLine(op.goal)),
 *         requires:<readiness of each record kind readsOf(op.kind) declares, e.g. ['srs:settled','sds:open']>,
 *         inputs:<the file+digest inputs bound at launch - op.references resolved, op.dependencyDigests>,
 *         model:{runtime:op.runtime,model:op.target},
 *         reason:allocated.adaptive?.reason
 *           ??(allocated.preferredOver?.length?'shared-load'
 *             :allocated.sparedOver?.length?'provider-budget'
 *             :allocated.preference?'owner-preference':'deficit')});
 *
 *   settle — `applyOpReport`: beside each `op-done` appendEvent (~lines 2533 and 2551). The delta is the
 *     completionOutlook the event already spreads:
 *       ctx.trace.emit('settle',{op:op.id,output:report.summary,delta:completionOutlook(state,op,clockOf(ctx))});
 *     An 'acceptance-pending', 'retry' or quarantined return settles nothing - no line.
 *
 *   block — `handleBlocked` (~line 2064): one emit at each classified return. Route is the target the
 *     classification chose: credentialRequest → 'owner-ask' (~2071); shared-change → the created shared
 *     op, or 'answering' when no path was named (~2095/2098); interface-gap → 'interface.draw' via
 *     reopenInterface (~2102); grammar-gap → 'grammar.update' via growGrammar (~2106); srs-gap →
 *     'business.revise' via reopenBusiness, else 'needUser' (~2110-2115); sds-gap → 'architecture.revise',
 *     else 'needUser' (~2117-2135); environment/authority → 'owner-ask' (~2142/2145); fallback →
 *     'needUser' (~2149):
 *       ctx.trace.emit('block',{op:op.id,kind:blocker.kind,detail:blocker.detail,
 *         route:<target kind | created op id | 'owner-ask' | 'needUser' | 'answering'>,
 *         attempt:op.attempt,limit:routeOf({blocker:blocker.kind,kind:op.kind})?.limit});
 *
 *   defer — `scheduleOps` at each deferred event: 'schedule-deferred' (~1129, ~1135, ~1142, and 'brand
 *     missing' inside deferForBrand ~907), 'allocation-deferred' (~1186), 'admission-deferred' (~1226);
 *     the deferForIntegrationPreparation `continue` (~1115) emits {reason:'integration preparation
 *     missing'}:
 *       ctx.trace.emit('defer',{op:op.id,reason:<the event's reason>});
 *     The `busy.length>=ctx.allocator.maxParallelOps` break (~1118) appends no journal event, so it writes
 *     no line.
 */
