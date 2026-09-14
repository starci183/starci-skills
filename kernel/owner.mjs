import fs from 'node:fs';
import {addOp,firstLine,liveStatus,locateSharedTreePaths,need,slash,unique,validateCommandAt} from './common.mjs';
import {closeOpTerminal} from './terminals.mjs';

/**
 * The owner loop, in one file, because it is one rule: the runtime prepares a decision and the owner takes it.
 * It was written inside the 318 KB kernel and read like three unrelated helpers; here the three seams of the
 * loop stand next to each other - open the question, prepare the answer, deliver the owner's ruling - and the
 * one thing they all say is visible at a glance: the kernel never answers for the owner.
 *
 * What the 5-plus ruling added is WHEN the work stops for that answer. The owner is asked - and the requester
 * waits - for exactly two reasons: something only the owner can provide (a credential, an account on an outside
 * system, a real dataset, a legal authority), and an external effect that cannot be undone (a message to real
 * customers, a payment, a deletion of real data, a publish). Every other question the records do not settle is
 * taken PROVISIONALLY on the runtime's own recommendation and the work carries on; the owner is told, answers
 * when they like, and a different answer reopens what was built on it. A mechanical bound - review rounds,
 * shared-change depth, launch attempts, a record path an op asked for - is never a question for the owner at all.
 */
/**
 * The two operations that put something to the owner. `decision.prepare` prepares a decision - the question,
 * the sides, the numbered options, one recommendation - that the runtime takes provisionally and the owner
 * overturns later; it never waits. `provision.ask` asks for the one thing only the owner can give (a credential,
 * an account, a dataset, an authority, the go-ahead for an irreversible effect) and waits in its own tab. The old
 * single kind `owner.ask` is renamed on kernel start (`kind-renamed`).
 */
export const DECISION_PREPARE='decision.prepare';
export const PROVISION_ASK='provision.ask';
export const ASK_KINDS=Object.freeze([DECISION_PREPARE,PROVISION_ASK]);
export const isAsk=kind=>ASK_KINDS.includes(String(kind??''));
/**
 * The two reasons a question stops the work. `credential` is one member of the provision class below; the
 * others stop the requester exactly as it does, because a proof against a system nobody gave us an account on,
 * or against data nobody gave us, is not a proof.
 */
export const STOP_KINDS=['credential','account','dataset','authority','irreversible'];
/** What only the owner can provide. Every one of these pauses the requester until the owner has provided it. */
export const PROVISION_KINDS=['credential','account','dataset','authority'];
/** The closed set of question kinds an operation or the kernel may raise. */
export const QUESTION_KINDS=[...PROVISION_KINDS,'irreversible','decision','hidden-decision','conflict','mechanical'];

/** Whether a blocker detail names a credential or a configuration the environment must provide. */
export function credentialNeed(detail){
  const text=String(detail??'');
  return /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){1,}\b/.test(text)||/\b(api[ -]?key|token|secret|credential|password|client[ -]?id|webhook|oauth)\b/i.test(text);
}
/**
 * The outside systems a product is proven against. The list is deliberately a vocabulary of ROLES - what the
 * system does for the product - and carries no vendor name, so an accounting product and a chat product are
 * read by the same rule.
 */
const EXTERNAL='payments?|card|bank\\w*|acquirer|e-?invoic\\w*|invoicing|tax|customs|sms|e-?mail|mail|messaging|identity|sso|single sign-?on|storage|bucket|accounting|billing|ledger provider|kyc|telephony|shipping|carrier|gateway|aggregator|provider|authority|marketplace|exchange|registry|erp|crm';
/**
 * What the owner has to provide, as one closed table. Each row is one product-agnostic rule, and the order is
 * the order they are read in: a key is a key even when it belongs to an account, and an account is an account
 * even when the sentence also mentions data.
 */
const PROVISION_RULES=[
  ['account',/\b(?:sandbox|test|staging|demo|trial|developer|merchant|seller|partner)[ -](?:account|tenant|environment|portal|subscription)\b/i],
  ['account',new RegExp(`\\b(?:${EXTERNAL})\\b[^.\\n]{0,40}\\baccounts?\\b|\\baccounts?\\b[^.\\n]{0,40}\\b(?:${EXTERNAL})\\b`,'i')],
  ['account',new RegExp(`\\b(?:register|registered|registering|sign ?up|signed up|onboard|enrol|enroll|apply)\\b[^.\\n]{0,80}\\b(?:${EXTERNAL})\\b`,'i')],
  ['dataset',/\b(?:real|production|live|sample|reference|golden|anonymi[sz]ed|historical)\b(?:\s+\S+){0,3}\s+(?:data|datasets?|data ?set|records?|statements?|invoices?|receipts?|exports?|extracts?|transactions?|documents?)\b/i],
  ['dataset',/\b(?:dataset|data ?set|sample file|sample data|test data|fixture data|bank statement|statement export)\b[^.\n]{0,100}\b(?:the owner|owner must|owner has to|only the owner|provides?|supply|supplies|hands? over|uploads?)\b/i],
  ['authority',/\b(?:may we|are we allowed to|do we have (?:the )?(?:right|permission|consent))\b/i],
  ['authority',/\b(?:permission|consent|authori[sz]ation|authori[sz]ed?|mandate|legal basis|sign-?off)\b[^.\n]{0,100}\b(?:customers?|users?|clients?|subscribers?|recipients?|cards?|charge|payments?|personal data|identity|pii|production data)\b/i]
];
/**
 * What the runtime cannot obtain for itself: the exact thing the owner has to hand over, by kind. `null` is the
 * answer for everything the runtime can get on its own - a missing tool, a red suite, a design question.
 *
 * The kinds are not chat channels and not one vendor's keys: an accounting product needs a sandbox account on
 * the tax authority, a real bank statement to reconcile against and the owner's authority to send an invoice to
 * a real customer, and each of those is as unobtainable by a runtime as a token is.
 */
export function ownerProvisionNeed(detail){
  const text=String(detail??'');
  if(!text.trim())return null;
  if(credentialNeed(text))return {kind:'credential'};
  for(const [kind,pattern] of PROVISION_RULES)if(pattern.test(text))return {kind};
  return null;
}
/**
 * An effect on the world that no later operation can take back: a message that reached a real person, money
 * that moved, real data that is gone, a release the public has. The runtime prepares it and stops; only the
 * owner performs it, because "undo" is not one of the runtime's verbs.
 */
const IRREVERSIBLE_RULES=[
  /\b(?:send|sends|sending|sent|deliver|delivers|delivering|notify|notifies|notifying|message|messages|messaging|e-?mail|e-?mails|e-?mailing|sms|broadcast|announce)\b[^.\n]{0,80}\b(?:real|actual|live|production)?\s?(?:customers?|users?|clients?|subscribers?|recipients?|members?|patients?|students?|audience|mailing list|inbox(?:es)?|phone numbers?)\b/i,
  /\b(?:charge|charges|charging|charged|capture|captures|debit|debits|pay|pays|paying|payout|payouts|transfer|transfers|transferring|refund|refunds|refunding|settle|settles|settlement|disburse|disburses)\b[^.\n]{0,80}\b(?:real|actual|live|production)?\s?(?:money|funds?|cards?|accounts?|customers?|balance|wallet|invoices?|payments?)\b/i,
  /\b(?:delete|deletes|deleting|deleted|drop|drops|dropping|purge|purges|purging|truncate|truncates|wipe|wipes|erase|erases|destroy|destroys)\b[^.\n]{0,80}\b(?:production|live|real|customer|customers'?|user|users'?|tenant)\b[^.\n]{0,40}\b(?:data|database|records?|rows?|tables?|bucket|files?|accounts?|backups?)\b/i,
  /\b(?:publish|publishes|publishing|published|deploy|deploys|deploying|deployed|release|releases|releasing|released|roll ?out|rolls out|ship|ships|shipping|go live|going live)\b[^.\n]{0,80}\b(?:production|prod|live|the public|customers?|app ?store|play ?store|registry|npm|the marketplace)\b/i
];
/** Whether a detail names an external effect nobody can undo. Product-agnostic: the verb and what it reaches. */
export function irreversibleEffect(detail){
  const text=String(detail??'');
  return IRREVERSIBLE_RULES.some(pattern=>pattern.test(text));
}
/**
 * The stop reason of a question, or null when the question is one the runtime may take provisionally. The
 * detail decides first, because an operation's own label for its question is a guess and the words it used are
 * evidence; a kind an operation declares outright is honoured only for the unambiguous ones - `authority` is
 * also the kernel's own generic blocker kind, so that word alone never stops the work.
 */
export function stopReasonFor(question){
  // A question the kernel PREPARED itself (`prepared: true` - the critic's decisive hidden decision, planned before
  // the feature's work) is one it decided to take provisionally. Its sentence names money or customers because that
  // is what the decision is ABOUT, not because an operation is about to charge or message anyone, so the words are
  // not read as a stop there - or every decision about a refund rule would halt the workflow. An operation's own
  // question is still read by its words first: its label is a guess, and what it says it would do is evidence.
  if(question?.prepared===true)return null;
  const text=`${question?.text??''}\n${question?.detail??''}`;
  if(irreversibleEffect(text))return 'irreversible';
  const provision=ownerProvisionNeed(text);
  if(provision)return provision.kind;
  const declared=String(question?.kind??'').toLowerCase();
  return ['credential','account','dataset','irreversible'].includes(declared)?declared:null;
}

/**
 * A secret never travels. The ask op is told to check presence and nothing else, and this is the second line of
 * that defence: anything that looks like a key - a long unbroken run of key characters - is masked before the
 * kernel writes it into an answer, an event, a report or a record.
 */
export function redactSecrets(text){
  // A slug of hyphenated lowercase words - a record id segment such as `d-sales-shared-public-route-contract` - is a
  // name, not a key: masking it once turned a provisional decision's record into "[redacted]", which the owner could
  // then never overturn. A key has digits and mixed case, or no word breaks at all.
  return String(text??'').replace(/\b[A-Za-z0-9_\-]{24,}\b/g,token=>/^[a-z]+(?:-[a-z0-9]+)+$/.test(token)&&(token.match(/\d/g)??[]).length<4?token:'[redacted]');
}

/** The feature folder of an op, in the TREE's own spelling - never the id segment, which is not a path. */
const featureFolderOf=(op,ctx)=>{
  const folderOf=where=>{const match=slash(String(where??'')).match(/features\/([^/]+)\//);return match?match[1]:null;};
  const fromTree=id=>{try{return folderOf(ctx?.work?.node?.(id)?.path);}catch{return null;}};
  return [op?.nodeId,...(op?.ledgerIds??[])].filter(Boolean).map(fromTree).find(Boolean)
    ??(op?.allowlist??[]).map(folderOf).find(Boolean)
    ??(op?.references??[]).map(folderOf).find(Boolean)
    ??null;
};
/**
 * The policy-decision folder of the feature an op belongs to, in the tree's own spelling: the feature FOLDER is
 * read from the node's path (`features/shared-lifecycle/...`), never from the id segment (`nivo.shared.`) - the
 * first owner questions were written under `features/shared/` and `features/workspace/`, folders that do not
 * exist, and the whole tree went red. A decision is an SRS policy-decision leaf, where the tree keeps them.
 */
export function decisionAllowlistFor(state,op,ctx=null){
  const feature=featureFolderOf(op,ctx);
  return feature?[`.starciwork/features/${feature}/business/srs/business-rules/policy-decisions/**`]:['.starciwork/decisions/**'];
}
/** One existing policy-decision record of the tree, for the ask op to mirror; none when the tree has none yet. */
function decisionExampleFor(ctx,feature){
  const list=ctx?.work?.loaded?.list??[];
  const under=list.filter(node=>/\/policy-decisions\/[^/]+\/index\.yaml$/.test(slash(node.path??'')));
  const same=feature?under.find(node=>slash(node.path).startsWith(`features/${feature}/`)):null;
  const chosen=same??under[0];
  return chosen?[slash(chosen.path)]:[];
}

/**
 * A question for the owner opens one `owner.ask` op that prepares the decision: a decided record that settles it
 * answers it (`answered-from`), otherwise a decision record draft with numbered options and one recommendation.
 *
 * What differs is what happens to the op that asked. A STOP question - something only the owner can provide, or
 * an effect nobody can undo - pauses it: there is nothing honest to do until the owner acts. Every other
 * question leaves it running work: it only waits for the ask op (`dependsOn`), and comes back with the
 * runtime's own recommendation as a PROVISIONAL answer. The kernel never answers such a question itself - the
 * supervisor model used to, and the owner was never asked for a key all day - but it no longer stops the
 * product over a question the owner can answer tomorrow.
 */
export function openOwnerAsk(store,state,op,question,ctx,report=null){
  // The op that prepares the owner's question cannot itself be prepared for: its block is the owner's item as it is.
  if(isAsk(op.kind)){
    op.status='blocked';
    state.needUser.push({op:op.id,kind:'decision',detail:`${op.id} could not prepare the question of ${(op.requesters??[]).join(', ')||'the workflow'}: ${firstLine(question.text)} - answer with workflow-answer --id ${state.id} --op ${op.id} --note "..."`,record:null,options:[],requesters:[...(op.requesters??[])]});
    store.appendEvent({event:'owner-question',ask:op.id,record:null,options:0,requesters:[...(op.requesters??[])],reason:'the ask op itself blocked'});
    return 'owner-question';
  }
  const stop=stopReasonFor(question);
  const kind=stop??(question.kind&&QUESTION_KINDS.includes(String(question.kind))?question.kind:'decision');
  const same=state.ops.find(item=>isAsk(item.kind)&&liveStatus.includes(item.status)&&item.question?.text===question.text);
  const allowlist=decisionAllowlistFor(state,op,ctx);
  const ask=same??addOp(store,state,{kind:stop?PROVISION_ASK:DECISION_PREPARE,nodeId:null,
    goal:`Prepare the owner's decision on the question ${op.id} asked: ${firstLine(question.text)}`,
    question:{...question,kind,stop:stop??null,from:op.id},ledgerIds:[],allowlist,
    references:unique([...(op.references??[]),...decisionExampleFor(ctx,(allowlist[0].match(/features\/([^/]+)\//)??[])[1]??null)]),
    checks:ctx?.work?.at?.workRoot?[{name:'work-tree-validates',command:validateCommandAt(ctx.work.at.workRoot)}]:[],
    acceptance:[`the question is either answered from a decided record (\`answered-from: <id>\`) or drafted as one decision record with numbered options and one recommendation`],
    origin:'ask',requesters:[op.id]},`question of ${op.id} for the owner`);
  if(!same&&ctx?.work)locateSharedTreePaths(ask,ctx);
  if(same)same.requesters=unique([...(same.requesters??[]),op.id]);
  const file=op.dispatch?store.reportPath(op.dispatch):null;
  if(file&&fs.existsSync(file))fs.renameSync(file,`${file}.asked-${op.reports.length}`);
  op.dispatch=null;op.terminal=null;op.nudged=false;
  if(stop){op.status='paused';op.waitingFor=ask.id;}
  // No stop reason: the op is not paused. It depends on the ask op - so nothing schedules it before the
  // recommendation exists - and the kernel resumes it with that recommendation as a provisional answer. An op
  // that is already finished is not restarted by a question raised on its behalf: it only carries the decision.
  else{op.dependsOn=unique([...(op.dependsOn??[]),ask.id]);if(liveStatus.includes(op.status)){op.status='pending';op.waitingFor=null;}}
  store.appendEvent({event:'owner-ask-opened',op:op.id,ask:ask.id,kind,stop:stop??null,provisional:!stop,question:firstLine(question.text)});
  return 'owner-ask';
}

/**
 * A conflict an intake recorded - a decided record of another feature that cannot hold together with this feature,
 * written as an open decision record with both sides, the numbered options and one recommendation - is taken the
 * way every other decision is: provisionally, on the recommendation, with the owner overturning it later. One
 * detached `decision.prepare` reads the record the intake wrote and reports the recommendation; nothing waits
 * for it, and the intake that raised it is finished already. The workflow never finishes `blocked` over a
 * conflict the runtime could take a side on and say so.
 */
export function openConflictDecision(store,state,intake,conflict,ctx){
  const record=typeof conflict?.decision==='string'&&conflict.decision.trim()?conflict.decision.trim():null;
  if(!record)return null;
  const same=state.ops.find(item=>isAsk(item.kind)&&item.question?.record===record&&!['failed'].includes(item.status));
  if(same)return same;
  let recordPath=null;
  try{recordPath=slash(ctx?.work?.node?.(record)?.path??'')||null;}catch{recordPath=null;}
  const folder=recordPath?recordPath.replace(/\/index\.yaml$/,''):null;
  const ask=addOp(store,state,{kind:DECISION_PREPARE,nodeId:null,
    goal:`Take the conflict ${intake.id} recorded provisionally: ${firstLine(conflict.detail??`${conflict.record} conflicts with what ${intake.intake?.scope??intake.id} needs`)}`,
    question:{kind:'decision',prepared:true,stop:null,record,from:intake.id,options:[...(conflict.options??[])],
      text:`${conflict.detail??`${conflict.record} conflicts with what ${intake.intake?.scope??intake.id} needs`} The decision record ${record} is already written with both sides, the numbered options and one recommendation: read it, print the question and the options in this terminal, and report \`decision: ${record}\` with \`recommended: <n>\` - the runtime takes it provisionally and the owner overturns it later with workflow-answer. Write nothing.`},
    // The record's own folder when the tree knows it; the feature's policy-decisions folder otherwise. The op writes nothing either way.
    ledgerIds:[],allowlist:folder?[`.starciwork/${folder}/**`]:decisionAllowlistFor(state,intake,ctx),references:unique([...(recordPath?[recordPath]:[]),...(intake.references??[]).slice(0,8)]),
    checks:[],acceptance:[`the summary begins \`decision: ${record}\` with \`recommended: <n>\` and the numbered options, and no file changed`],
    origin:'ask',requesters:[]},`conflict of ${intake.id} taken provisionally`);
  if(ask)store.appendEvent({event:'owner-ask-opened',op:intake.id,ask:ask.id,kind:'decision',stop:null,provisional:true,record,question:firstLine(conflict.detail??record)});
  return ask;
}

/**
 * A report's summary reaches the kernel with its newlines collapsed into spaces (`buildReport` normalizes
 * whitespace), so every marker the ask op writes is read out of one line: `<key>: <value>` anywhere in it, and
 * the numbered options as a run that starts at 1 and counts up. Reading them per line worked only for questions
 * that already carried their options, and silently gave every other decision "option 1".
 */
const marker=(summary,key)=>new RegExp(`(?:^|\\s)${key}:\\s*`,'i').test(summary)
  ?summary.slice(summary.search(new RegExp(`(?:^|\\s)${key}:\\s*`,'i'))).replace(new RegExp(`^\\s*${key}:\\s*`,'i'),'')
  :null;
const numberedOptions=summary=>{
  const found=[...String(summary??'').matchAll(/(?:^|\s)(\d+)\.\s+(.*?)(?=\s+\d+\.\s|$)/gs)]
    .map(match=>({at:Number(match[1]),text:String(match[2]).trim()})).filter(item=>item.text);
  const run=[];
  for(const item of found){if(item.at!==run.length+1)break;run.push(item.text);}
  return run;
};
const optionsOf=(ask,summary)=>ask.question?.options?.length?[...ask.question.options]:numberedOptions(summary);
const requestersOf=(state,ask)=>state.ops.filter(item=>(ask.requesters??[]).includes(item.id));

/**
 * The ask op reported. Five shapes, and the first line of the summary says which:
 *
 * - `answered-from: <id>` - a decided record settles it; every requester gets that answer.
 * - `answered-by-owner: <n>` - the owner typed the number in the op's own terminal; exactly `workflow-answer`.
 * - `credential: <VAR> present` / `provided: <what>` - the owner provided the thing and the op checked ONLY
 *   that it is there. The value never reaches the kernel, so it can never reach a file.
 * - `decision: <id>` on a STOP question - the owner's item on the list, the requester still paused.
 * - `decision: <id>` on any other question - the recommendation becomes a provisional answer, the requesters
 *   carry on, and the decision is listed under `state.provisional` until the owner confirms or overturns it.
 */
export function settleOwnerAsk(store,state,ask,report){
  const summary=redactSecrets(String(report.summary??''));
  const requesters=requestersOf(state,ask);
  const fromRecord=marker(summary,'answered-from');
  if(fromRecord){
    const [record,...rest]=fromRecord.split(/\s+/);
    for(const requester of requesters)resumeWithAnswer(store,state,requester,`Answered from the decided record ${record}: ${rest.join(' ').trim()||'see that record'}`);
    store.appendEvent({event:'owner-ask-answered-from-record',ask:ask.id,record,requesters:requesters.map(item=>item.id)});
    return;
  }
  // The owner answered in the tab while the op was still open: the same ruling as the command, by another door.
  const inTerminal=(String(marker(summary,'answered-by-owner')??'').match(/^\d+/)??[])[0]??null;
  if(inTerminal){
    settleChoice(store,state,ask,{choice:inTerminal,note:null,options:optionsOf(ask,summary),via:'terminal'});
    return;
  }
  // A provision the owner made: only its presence is reported, never its value. The credential form names the
  // variable and the custody it lives in and nothing else, so a value cannot travel even by accident.
  const credential=(String(marker(summary,'credential')??'').match(/^([A-Za-z][A-Za-z0-9_]*)\s+present(?:\s+in\s+(\S+))?/)??null);
  const provided=credential?null:marker(summary,'provided');
  if(credential||provided){
    const what=credential?`${credential[1]}${credential[2]?` in ${credential[2]}`:''}`:String(provided).slice(0,120).trim();
    const answer=`The owner provided ${what}; the operation confirmed only that it is present and never read its value. Read it from its custody at the moment of use and never copy it into a file, a log or a report.`;
    for(const requester of requesters)resumeWithAnswer(store,state,requester,answer);
    store.appendEvent({event:'credential-present',ask:ask.id,provided:what,requesters:requesters.map(item=>item.id)});
    return;
  }
  const record=(String(marker(summary,'decision')??'').match(/^\S+/)??[])[0]??null;
  const options=optionsOf(ask,summary);
  const stop=ask.question?.stop??stopReasonFor(ask.question??{});
  if(stop){
    state.needUser.push({op:ask.id,kind:'decision',detail:`${ask.question?.text??ask.goal} - answer with workflow-answer --id ${state.id} --op ${ask.id} --choice <n> [--note "..."]${record?` (decision record ${record})`:''}`,record,options,requesters:requesters.map(item=>item.id)});
    store.appendEvent({event:'owner-question',ask:ask.id,record,options:options.length,stop,requesters:requesters.map(item=>item.id)});
    return;
  }
  const recommended=Number((String(marker(summary,'recommended')??'').match(/^\d+/)??[])[0]??1)||1;
  openProvisional(store,state,ask,{record,options,recommended,requesters});
}

/**
 * The runtime's own recommendation, taken and recorded as provisional. The requesters continue on it, every op
 * that rests on it carries the decision id, and the decision is listed for the owner as something to answer -
 * not as something the workflow is blocked on. `done` over a provisional decision is a legitimate outcome; a
 * different answer later is what reopens what was built.
 */
export function openProvisional(store,state,ask,{record,options,recommended,requesters}){
  const decision=record??ask.id;
  const chosen=options[recommended-1]??options[0]??'the recommendation in the decision record';
  const answer=`provisional: option ${recommended} - ${chosen} (decision ${decision}). The runtime took its own recommendation so the work could continue; the owner may answer differently, and what rests on it is reopened then.`;
  state.provisional=[...(state.provisional??[]),
    {decision,op:ask.id,recommended,options:[...options],at:Date.now(),answered:null}];
  for(const requester of requesters){
    requester.provisional=unique([...(requester.provisional??[]),decision]);
    // A requester that already finished carries the decision and nothing more: it is not restarted by an answer
    // it did not wait for. What reopens finished work is the owner answering DIFFERENTLY, later.
    if(!liveStatus.includes(requester.status))continue;
    resumeWithAnswer(store,state,requester,answer);
    store.appendEvent({event:'owner-answer-provisional',op:requester.id,ask:ask.id,decision,recommended});
  }
  store.appendEvent({event:'owner-question-provisional',ask:ask.id,decision,recommended,options:options.length,
    requesters:requesters.map(item=>item.id)});
  return decision;
}

export function resumeWithAnswer(store,state,op,answer){
  op.answer=redactSecrets(answer);op.status='ready';op.waitingFor=null;op.dispatch=null;op.terminal=null;op.nudged=false;op.attempt+=1;
  store.appendEvent({event:'owner-answer-delivered',op:op.id,answer:firstLine(op.answer)});
}

/**
 * A provisional decision travels: an op that depends on one, or that works the same node or ledger item after
 * one was taken, was built on it too. That is what makes `decision-overturned` honest - the kernel knows which
 * done work rested on the answer it gave itself.
 */
export function inheritProvisional(state){
  const ids=state.ops.map(op=>op.id);
  const shares=(op,other)=>Boolean(op.nodeId&&op.nodeId===other.nodeId)
    ||(op.ledgerIds??[]).some(id=>(other.ledgerIds??[]).includes(id));
  for(let round=0;round<ids.length;round+=1){
    let changed=false;
    for(const op of state.ops){
      const at=state.ops.indexOf(op);
      const carried=unique([...(op.provisional??[]),
        ...state.ops.filter(other=>(op.dependsOn??[]).includes(other.id)).flatMap(other=>other.provisional??[]),
        ...state.ops.filter(other=>(other.provisional??[]).length&&state.ops.indexOf(other)<at&&shares(op,other)).flatMap(other=>other.provisional??[])]);
      if(carried.length===(op.provisional??[]).length)continue;
      op.provisional=carried;changed=true;
    }
    if(!changed)break;
  }
  return state.ops.filter(op=>(op.provisional??[]).length).map(op=>op.id);
}

/** The owner's ruling on one question, however it reached the kernel: the command, or the op's own terminal. */
function settleChoice(store,state,ask,{choice,note,options,via,ctx=null}){
  const picked=choice!==null&&choice!==undefined&&String(choice).trim()?options[Number(choice)-1]??String(choice):null;
  const question=ask.question?.text??ask.goal;
  const answer=`The owner decided on "${firstLine(question)}": ${picked?`option ${choice} - ${picked}`:''}${picked&&note?'; ':''}${note??''}`.trim();
  ask.answer={choice:picked?String(choice):null,note:note??null,at:Date.now(),via};
  state.needUser=state.needUser.filter(entry=>!(entry.op===ask.id&&entry.kind==='decision'));
  const entry=(state.provisional??[]).find(item=>item.op===ask.id&&!item.answered)??null;
  const requesters=requestersOf(state,ask);
  if(entry)settleProvisional(store,state,entry,{choice,note,answer,ctx});
  for(const requester of requesters){
    if(entry&&!liveStatus.includes(requester.status)&&Number(choice)===entry.recommended)continue;
    resumeWithAnswer(store,state,requester,answer);
  }
  store.appendEvent({event:'owner-answered',ask:ask.id,choice:picked?String(choice):null,note:note??null,via,
    requesters:requesters.map(item=>item.id)});
  // The question has its answer: the tab that showed it has no reader any more.
  if(ctx?.orca&&ask.terminal&&ask.status==='done')closeOpTerminal(ctx.orca,store,state,ask);
  return {ask:ask.id,answer};
}

/**
 * The owner answered a decision the runtime had already taken. The same number is a confirmation and changes
 * nothing that was built; a different number overturns it, and every done node whose kernel receipt lists that
 * decision goes back to `todo` - because it was built on an answer the owner has now replaced.
 */
function settleProvisional(store,state,entry,{choice,note,answer,ctx}){
  entry.answered={choice:choice===null||choice===undefined?null:String(choice),note:note??null,at:Date.now()};
  if(Number(choice)===entry.recommended){
    store.appendEvent({event:'decision-confirmed',decision:entry.decision,ask:entry.op,choice:String(choice)});
    return [];
  }
  const reopened=reopenForDecision(store,state,ctx,entry.decision,answer);
  store.appendEvent({event:'decision-overturned',decision:entry.decision,ask:entry.op,
    choice:choice===null||choice===undefined?null:String(choice),reopened});
  return reopened;
}

/** Every done op that carried the decision: its node is reopened in the tree and its work is planned again. */
function reopenForDecision(store,state,ctx,decision,answer){
  const reopened=[];
  for(const op of state.ops.filter(item=>item.status==='done'&&(item.provisional??[]).includes(decision))){
    op.status='ready';op.attempt=(op.attempt??1)+1;op.verdict=null;op.dispatch=null;op.terminal=null;op.nudged=false;
    op.findings=unique([...(op.findings??[]),`the owner overturned the provisional decision ${decision}: ${firstLine(answer)}`]);
    for(const id of unique([op.nodeId,...(op.ledgerIds??[])].filter(Boolean))){
      const item=state.ledger.find(entry=>entry.id===id||entry.nodeId===id);
      if(item)item.status='planned';
    }
    if(!op.nodeId)continue;
    reopened.push(op.nodeId);
    try{
      const node=ctx?.work?.node?.(op.nodeId);
      if(node&&typeof ctx?.work?.api?.markReopened==='function')
        ctx.work.api.markReopened(ctx.work.at,node,{reason:`decision-overturned: ${decision}`,by:'starci-kernel'});
    }catch(error){store.appendEvent({event:'ledger-write-failed',op:op.id,node:op.nodeId,step:'reopened',reason:String(error?.message??error).slice(0,240)});}
  }
  return unique(reopened);
}

/**
 * The owner's answer (`workflow-answer`): recorded on the ask op, delivered to every requester, the question gone.
 *
 * It settles three shapes with one command. An `owner.ask` op answers on the ask. A reconciliation conflict
 * answers on the intake op that wrote the decision record - the intake itself is already accepted, and
 * re-running it would undo the reconciliation the owner just settled, so only a live requester is resumed. And
 * a decision the runtime already took provisionally is confirmed or overturned here.
 */
export function answerOwnerQuestion(store,state,{op:askId,choice=null,note=null},ctx=null){
  const ask=state.ops.find(item=>item.id===askId&&isAsk(item.kind))??null;
  const item=state.needUser.find(entry=>entry.op===askId&&entry.kind==='decision')??null;
  const pending=(state.provisional??[]).find(entry=>entry.op===askId&&!entry.answered)??null;
  const raiser=ask??(item?state.ops.find(entry=>entry.id===askId)??null:null);
  need(raiser||pending,`No owner question ${askId} in workflow ${state.id}`);
  const options=item?.options??raiser?.question?.options??pending?.options??[];
  const picked=choice!==null&&choice!==undefined&&String(choice).trim()?options[Number(choice)-1]??String(choice):null;
  need(picked||String(note??'').trim(),'workflow-answer needs --choice <n> or --note "<answer>"');
  if(ask)return settleChoice(store,state,ask,{choice,note,options,via:'command',ctx});
  const question=item?.detail??raiser?.goal??pending?.decision??askId;
  const answer=`The owner decided on "${firstLine(question)}": ${picked?`option ${choice} - ${picked}`:''}${picked&&note?'; ':''}${note??''}`.trim();
  const decided={choice:picked?String(choice):null,note:note??null,at:Date.now()};
  const requesters=item?.requesters??[];
  if(raiser)raiser.decisions=[...(raiser.decisions??[]),{record:item?.record??null,...decided,answer}];
  state.needUser=state.needUser.filter(entry=>!(entry.op===askId&&entry.kind==='decision'));
  if(pending)settleProvisional(store,state,pending,{choice,note,answer,ctx});
  for(const requester of state.ops.filter(candidate=>requesters.includes(candidate.id))){
    if(!liveStatus.includes(requester.status))continue;
    resumeWithAnswer(store,state,requester,answer);
  }
  store.appendEvent({event:'owner-answered',ask:askId,choice:decided.choice,note:note??null,via:'command',
    record:item?.record??null,requesters:[...requesters]});
  return {ask:askId,answer};
}

/** The command that answers one decision, printed wherever a decision is shown. */
export const answerCommand=(state,op)=>`starci workflow-answer --id ${state.id} --op ${op} --choice <n> [--note "..."]`;
/**
 * The provisional decisions of a workflow as a page section. The same lines are printed by the status view and
 * carried in the final report, because a decision the runtime took for the owner has to be visible in both.
 */
export function provisionalLines(state){
  const open=(state?.provisional??[]).filter(entry=>!entry.answered);
  if(!open.length)return [];
  return [`## Provisional decisions (${open.length})`,
    ...open.map(entry=>`- ${entry.decision}: the runtime took option ${entry.recommended}`
      +`${entry.options?.[entry.recommended-1]?` - ${entry.options[entry.recommended-1]}`:''}`
      +` and carried on. Answer with \`${answerCommand(state,entry.op)}\`; a different option reopens what was built on it.`)];
}

/**
 * One item per question, never the same question four times. A kernel that runs for a day pushed the same
 * `no runtime could launch` line on every iteration and the morning list was unreadable; the key is what the
 * owner actually reads - the kind, the op or node it is about, and the first sentence of the detail.
 */
export function dedupeNeedUser(state){
  const seen=new Set(),kept=[];
  for(const item of state.needUser??[]){
    const key=`${item?.kind??''}|${item?.op??item?.node??''}|${String(item?.detail??'').slice(0,120)}`;
    if(seen.has(key))continue;
    seen.add(key);kept.push(item);
  }
  const dropped=(state.needUser??[]).length-kept.length;
  state.needUser=kept;
  return dropped;
}

/** The kernel answers only mechanical questions (which runtime, a retry, a format); everything else is the owner's. */
export const MECHANICAL_QUESTION=/^(mechanical|runtime|retry|format|tooling)$/i;
export function answerOrEscalate(orca,store,state,op,report,ctx){
  if(!MECHANICAL_QUESTION.test(String(report.question?.kind??'')))return openOwnerAsk(store,state,op,{kind:report.question?.kind??'decision',text:report.question?.text??report.summary,options:report.question?.options??[]},ctx,report);
  const chosen=ctx.decide({situation:`${op.id} asked: ${report.question?.text}`,options:['answer','escalate-to-user'],
    context:{options:report.question?.options??[],goal:firstLine(op.goal),allowlist:op.allowlist,acceptance:op.acceptance},cwd:ctx.cwd});
  const option=chosen?.ok?chosen.value.option:'escalate-to-user';
  store.appendEvent({event:'decide',op:op.id,option,rationale:chosen?.ok?chosen.value.rationale:'decide produced no valid option'});
  if(option==='answer'&&chosen.value.instructions){
    // The answered report file is retained out of the way so the operation can report once more on the same Dispatch.
    const file=store.reportPath(op.dispatch);
    if(fs.existsSync(file))fs.renameSync(file,`${file}.answered-${op.reports.length}`);
    op.answer=chosen.value.instructions;op.status='answering';
    return 'answer';
  }
  // The model could not answer a question it was told is mechanical: that is a question after all, and the
  // runtime takes it provisionally rather than stopping the product on it.
  return openOwnerAsk(store,state,op,{kind:'decision',text:report.question?.text??'the operation asked a question the kernel cannot answer',options:report.question?.options??[]},ctx,report);
}
