import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {AUTHOR_KIND,addOp,firstLine,isEnrolled,liveStatus,locateSharedTreePaths,need,slash,unique,validateCommandAt} from './common.mjs';
import {closeOpTerminal,keepsAskTab} from './terminals.mjs';
import {settleCredentialPresence,askFillLine} from './fill.mjs';

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
 * The kinds an operation may declare outright and be believed. `authority` is not among them: it is also the
 * kernel's own generic blocker kind, so that word alone never stops the work.
 */
const DECLARED_STOPS=['credential','account','dataset','irreversible'];
/**
 * What the operation SAID, when it said anything at all. A report that names its blocker kind - or a question
 * that carries one of the four - knows better than any sentence: it is the op standing in front of the thing.
 * The words are only consulted when nothing was declared, because a keyword in a sentence is a hint about the
 * tab to open, never a ruling about what the question is.
 */
export function declaredStopOf(question,report=null){
  if(question?.prepared===true)return null;
  for(const candidate of [report?.blocker?.kind,question?.kind]){
    const value=String(candidate??'').toLowerCase();
    if(DECLARED_STOPS.includes(value))return value;
  }
  return null;
}
/**
 * The stop reason of a question, or null when the question is one the runtime may take provisionally. What the
 * operation declared decides first; only when it declared nothing unambiguous are the words of the question
 * read. The other order cost an hour: "which Telegram bot token does the chatbot use, and where does the owner
 * provide it" is a DESIGN decision - where a value lives - and the word "token" alone made it a provision.
 */
export function stopReasonFor(question,report=null){
  // A question the kernel PREPARED itself (`prepared: true` - the critic's decisive hidden decision, planned before
  // the feature's work) is one it decided to take provisionally. Its sentence names money or customers because that
  // is what the decision is ABOUT, not because an operation is about to charge or message anyone, so the words are
  // not read as a stop there - or every decision about a refund rule would halt the workflow.
  if(question?.prepared===true)return null;
  const declared=declaredStopOf(question,report);
  if(declared)return declared;
  const text=`${question?.text??''}\n${question?.detail??''}`;
  if(irreversibleEffect(text))return 'irreversible';
  const provision=ownerProvisionNeed(text);
  return provision?provision.kind:null;
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
  // A variable NAME is never a value either: `RECOVERY_CUSTODY_SECRET_KEY` is what the code reads, and masking it
  // once turned "credential: <VAR> present in identity:<slug>" into "credential: [redacted] present ...", which the
  // kernel could not read as the credential's presence - so the requester stayed paused on a provision already
  // made. An environment variable name is upper case, digits and underscores, starting with a letter.
  return String(text??'').replace(/\b[A-Za-z0-9_\-]{24,}\b/g,token=>
    (/^[a-z]+(?:-[a-z0-9]+)+$/.test(token)&&(token.match(/\d/g)??[]).length<4)||/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(token)?token:'[redacted]');
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
  // The shape of the tab is a HINT, not a ruling: whichever of the two forms is opened, the ask op may come back
  // with either answer and the kernel takes it by what the report says (`settleOwnerAsk`).
  const stop=stopReasonFor(question,report);
  const enrolled=ctx?.engine===true||isEnrolled(state);
  const ownerRequired=enrolled&&!MECHANICAL_QUESTION.test(String(question?.kind??''));
  const by=stop?(declaredStopOf(question,report)?'declared':'words'):'none';
  const kind=stop??(question.kind&&QUESTION_KINDS.includes(String(question.kind))?question.kind:'decision');
  const same=state.ops.find(item=>isAsk(item.kind)&&liveStatus.includes(item.status)&&item.question?.text===question.text&&item.question?.inputRevision===question.inputRevision);
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
  if(stop||ownerRequired){op.status='paused';op.waitingFor=ask.id;}
  // No stop reason: the op is not paused. It depends on the ask op - so nothing schedules it before the
  // recommendation exists - and the kernel resumes it with that recommendation as a provisional answer. An op
  // that is already finished is not restarted by a question raised on its behalf: it only carries the decision.
  else{op.dependsOn=unique([...(op.dependsOn??[]),ask.id]);if(liveStatus.includes(op.status)){op.status='pending';op.waitingFor=null;}}
  store.appendEvent({event:'owner-ask-opened',op:op.id,ask:ask.id,kind,stop:stop??null,by,provisional:!stop&&!ownerRequired,ownerRequired,question:firstLine(question.text)});
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
  const enrolled=ctx?.engine===true||isEnrolled(state);
  const ask=addOp(store,state,{kind:DECISION_PREPARE,nodeId:null,
    goal:`${enrolled?`Present the conflict ${intake.id} recorded to the owner`:`Take the conflict ${intake.id} recorded provisionally`}: ${firstLine(conflict.detail??`${conflict.record} conflicts with what ${intake.intake?.scope??intake.id} needs`)}`,
    question:{kind:'decision',prepared:true,stop:null,record,from:intake.id,options:[...(conflict.options??[])],
      text:`${conflict.detail??`${conflict.record} conflicts with what ${intake.intake?.scope??intake.id} needs`} The decision record ${record} is already written with both sides and numbered options: read it and report \`decision: ${record}\` with ${enrolled?'the options. The authenticated owner must choose; do not select an option.':'`recommended: <n>`; the runtime takes it provisionally and the owner may overturn it.'} Write nothing.`},
    // The record's own folder when the tree knows it; the feature's policy-decisions folder otherwise. The op writes nothing either way.
    ledgerIds:[],allowlist:folder?[`.starciwork/${folder}/**`]:decisionAllowlistFor(state,intake,ctx),references:unique([...(recordPath?[recordPath]:[]),...(intake.references??[]).slice(0,8)]),
    checks:[],acceptance:[enrolled?`the summary begins \`decision: ${record}\` with the numbered options and no selected answer, and no file changed`:`the summary begins \`decision: ${record}\` with \`recommended: <n>\` and the numbered options, and no file changed`],
    origin:'ask',requesters:[]},`conflict of ${intake.id} taken provisionally`);
  if(ask)store.appendEvent({event:'owner-ask-opened',op:intake.id,ask:ask.id,kind:'decision',stop:null,by:'none',provisional:!enrolled,ownerRequired:enrolled,record,question:firstLine(conflict.detail??record)});
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
/**
 * `presentation (vi): <question in that language> 1. <option 1> 2. <option 2>` at the end of an ask's summary: what
 * the owner page shows, in the language of config.json. The record and the numbered options before it stay as the
 * tree spells them; the presentation is parsed off the summary before those options are read.
 */
const PRESENTATION=/(?:^|\s)presentation\s*\(([a-z]{2,3}(?:-[A-Za-z0-9]+)?)\)\s*:\s*/i;
const stripPresentation=summary=>{const match=PRESENTATION.exec(String(summary??''));return match?String(summary).slice(0,match.index):String(summary??'');};
export const presentationOf=summary=>{
  const text=String(summary??''),match=PRESENTATION.exec(text);if(!match)return null;
  const tail=text.slice(match.index+match[0].length),first=tail.search(/(?:^|\s)1\.\s/);
  const question=(first<0?tail:tail.slice(0,first)).trim(),options=first<0?[]:numberedOptions(tail.slice(first));
  return question||options.length?{language:match[1].toLowerCase(),text:question,options}:null;
};
/**
 * What an ask has already authored for the owner: the decision record it wrote and the numbered options in it.
 * An ask that holds both needs nothing more from its own operation to put the question on the owner's page, so the
 * kernel may publish it whatever else that operation is blocked on.
 */
export const authoredDecisionOf=summary=>{
  const text=redactSecrets(String(summary??''));
  const record=(String(marker(text,'decision')??'').match(/^\S+/)??[])[0]??null;
  const options=numberedOptions(stripPresentation(text));
  return record&&options.length>1?{record,options}:null;
};
const optionsOf=(ask,summary)=>ask.question?.options?.length?[...ask.question.options]:numberedOptions(stripPresentation(summary));
const requestersOf=(state,ask)=>state.ops.filter(item=>(ask.requesters??[]).includes(item.id));
/**
 * The question was not what the keyword that opened the tab said it was. The op's own question is corrected -
 * a provision that turned out to be a decision carries no stop any more, a decision that turned out to be a
 * provision carries one - and the change is on the record, because the requester's status moves with it.
 */
function reclassify(store,state,ask,from,to){
  const stop=to==='provision'?(ask.question?.kind&&PROVISION_KINDS.includes(String(ask.question.kind))?ask.question.kind:'credential'):null;
  ask.question={...(ask.question??{}),kind:to==='provision'?(stop??'credential'):'decision',stop};
  store.appendEvent({event:'ask-reclassified',ask:ask.id,from,to});
}

/**
 * The ask op reported. Five shapes, and the first line of the summary says which:
 *
 * - `answered-from: <id>` - a decided record settles it; every requester gets that answer.
 * - `answered-by-owner: <n>` - the owner typed the number in the op's own terminal; exactly `workflow-answer`.
 * - `credential: <VAR> present` / `provided: <what>` - the owner provided the thing and the op checked ONLY
 *   that it is there. The value never reaches the kernel, so it can never reach a file.
 * - `decision: <id>` with nothing else - the recommendation becomes a provisional answer, the requesters
 *   carry on, and the decision is listed under `state.provisional` until the owner confirms or overturns it.
 * - `blocked`, or a stop question that came back with no decision at all - the owner's item on the list.
 *
 * WHICH of them applies is read out of the report, never out of the op's kind. The shape of the tab was chosen
 * by a keyword before the op had read anything; the op read the records, and either form may end any of the
 * three ways. A `provision.ask` that found a design decision lifts its own stop (`ask-reclassified`), and a
 * `decision.prepare` that found a credential resumes its requester on the presence the owner provided.
 */
export function settleOwnerAsk(store,state,ask,report){
  const summary=redactSecrets(String(report.summary??''));
  const requesters=requestersOf(state,ask);
  const stop=ask.question?.stop??stopReasonFor(ask.question??{});
  const fromRecord=marker(summary,'answered-from');
  if(fromRecord){
    const [record,...rest]=fromRecord.split(/\s+/);
    for(const requester of requesters)resumeWithAnswer(store,state,requester,`Answered from the decided record ${record}: ${rest.join(' ').trim()||'see that record'}`);
    store.appendEvent({event:'owner-ask-answered-from-record',ask:ask.id,record,requesters:requesters.map(item=>item.id)});
    return;
  }
  if(isEnrolled(state)){
    const record=(String(marker(summary,'decision')??'').match(/^\S+/)??[])[0]??null,options=optionsOf(ask,summary);
    const recommended=Number((String(marker(summary,'recommended')??'').match(/^\d+/)??[])[0])||null,presentation=presentationOf(summary);
    ask.question={...(ask.question??{}),...(recommended?{recommended}:{}),...(presentation?{presentation}:{})};
    ask.ownerRequestStatus='waiting-owner';
    state.needUser.push({op:ask.id,kind:'decision',detail:`${ask.question?.text??ask.goal} - answer in the workflow owner page`,record,options,requesters:requesters.map(item=>item.id)});
    store.appendEvent({event:'owner-question',ask:ask.id,record,options:options.length,ownerRequired:true,requesters:requesters.map(item=>item.id)});
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
  const credential=(String(marker(summary,'credential')??'').match(/^([A-Za-z][A-Za-z0-9_]*)\s+present(?:\s+in\s+([^\s.,;]+))?/)??null);
  const provided=credential?null:marker(summary,'provided');
  if(credential||provided){
    const what=credential?`${credential[1]}${credential[2]?` in ${credential[2]}`:''}`:String(provided).slice(0,120).trim();
    const answer=`The owner provided ${what}; the operation confirmed only that it is present and never read its value. Read it from its custody at the moment of use and never copy it into a file, a log or a report.`;
    // The tab was opened as a decision and the question turned out to be a provision after all. The requester is
    // `pending` on this ask rather than paused, and the presence the owner provided is its answer just the same.
    if(!stop)reclassify(store,state,ask,'decision','provision');
    for(const requester of requesters)resumeWithAnswer(store,state,requester,answer);
    store.appendEvent({event:'credential-present',ask:ask.id,provided:what,requesters:requesters.map(item=>item.id)});
    return;
  }
  const record=(String(marker(summary,'decision')??'').match(/^\S+/)??[])[0]??null;
  const options=optionsOf(ask,summary);
  // A stop question that came back with a DECISION is not a provision: the keyword that opened the provision tab
  // was a hint and the op read the records. The stop is lifted here - nothing is left for the owner to provide -
  // and the recommendation is taken provisionally exactly as a prepared decision is, so the requester resumes.
  if(stop&&record)reclassify(store,state,ask,'provision','decision');
  else if(stop){
    state.needUser.push({op:ask.id,kind:'decision',detail:`${ask.question?.text??ask.goal} - answer with workflow-answer --id ${state.id} --op ${ask.id} --choice <n> [--note "..."]${record?` (decision record ${record})`:''}`,record,options,requesters:requesters.map(item=>item.id)});
    store.appendEvent({event:'owner-question',ask:ask.id,record,options:options.length,stop,requesters:requesters.map(item=>item.id)});
    return;
  }
  const recommended=Number((String(marker(summary,'recommended')??'').match(/^\d+/)??[])[0]??1)||1;
  openProvisional(store,state,ask,{record,options,recommended,requesters});
}

/** Resume exactly once after the kernel has accepted an authenticated owner inbox action. */
export function continueOwnerRequest(store,state,{receipt,currentRequest}={}){
  if(receipt?.schema!=='starci/owner-action-receipt@1'||receipt.status!=='applied'||!currentRequest
    ||receipt.requestId!==currentRequest.id||receipt.opId!==currentRequest.opId||receipt.revision!==currentRequest.revision)return {ok:false,code:'owner-continuation-receipt-invalid'};
  const ask=state.ops.find(item=>item.id===receipt.opId);
  if(!ask||ask.ownerAnswer?.receiptId!==receipt.ownerReceiptId)return {ok:false,code:'owner-continuation-answer-mismatch'};
  if(ask.ownerContinuationReceipt===receipt.ownerReceiptId)return {ok:true,code:'already-continued',resumed:[]};
  const resumed=[];
  for(const requester of requestersOf(state,ask)){
    if(requester.ownerContinuationReceipts?.includes(receipt.ownerReceiptId))continue;
    requester.ownerContinuationReceipts=unique([...(requester.ownerContinuationReceipts??[]),receipt.ownerReceiptId]);
    const chosen=ask.ownerAnswer?.type==='choose'?(ask.question?.options??[]).find(option=>(typeof option==='object'?String(option.id):String((ask.question.options??[]).indexOf(option)+1))===String(ask.ownerAnswer.value)):null;
    const value=ask.ownerAnswer?.kind==='credential-presence'?'Credential presence is stored in the declared custody; no value is carried here.'
      :ask.ownerAnswer?.type==='confirm'?'confirmed':ask.ownerAnswer?.type==='choose'?`selected ${typeof chosen==='object'?(chosen.label??chosen.text??chosen.id):(chosen??ask.ownerAnswer.value)}`:`answered ${String(ask.ownerAnswer?.value??'').slice(0,1000)}`;
    const record=ask.question?.record?` for decision record ${ask.question.record}`:'';
    requester.answer=`Authenticated owner action ${receipt.ownerReceiptId}${record}: ${value}`;
    if(requester.waitingFor===ask.id||requester.dependsOn?.includes(ask.id)){
      requester.waitingFor=null;requester.dependsOn=(requester.dependsOn??[]).filter(id=>id!==ask.id);
      if(['paused','pending','blocked'].includes(requester.status)){requester.status='ready';requester.refusal=null;}
      resumed.push(requester.id);
    }
  }
  ask.ownerContinuationReceipt=receipt.ownerReceiptId;
  if(['answered','saved','verified'].includes(currentRequest.status))ask.status='done';
  state.needUser=(state.needUser??[]).filter(item=>item.op!==ask.id);
  store.appendEvent({event:'owner-action-continued',ask:ask.id,receiptId:receipt.ownerReceiptId,actionType:receipt.actionType,resumed});
  return {ok:true,code:'continued',resumed};
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
  // The owner says they have filled the credential in. The word is not the answer: the presence of every
  // variable is checked exactly as the kernel's own tick checks it, and only that settles the ask - `set` over
  // a credential nobody put anywhere is a refusal that names what is missing, never a `done`.
  if(ask?.kind===PROVISION_ASK&&ask.question?.stop==='credential'&&/^set$/i.test(String(note??'').trim())){
    const asked=ask.credential??{};
    const settled=settleCredentialPresence(store,state,ask,{variables:asked.variables??[],custody:asked.custody??null,
      via:'command',...(ctx?.work?.at?.workRoot?{workRoot:ctx.work.at.workRoot}:{}),
      ...(ctx?.verifyPresence?{verifyPresence:ctx.verifyPresence}:{})});
    need(settled.ok,`${ask.id} is not settled: ${settled.reason}. Run \`${ask.fillCommand??'starci identity fill <slug> --name <VAR>'}\` and answer it.`);
    return {ask:ask.id,answer:settled.summary};
  }
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

/* ------------------------------------------------------------- what waits on the owner, in one place */

/**
 * The owner's state lived in three places at once - the ask ops waiting in their tabs, `state.provisional`, and
 * `state.needUser` - and no page put the three together. The owner opened the IDE, read six tabs, and asked
 * "where does it ask me?": every one of those places was honest on its own and none of them was an answer.
 *
 * `ownerItems` is that answer: one list, in the order the owner should act on it, where every entry says WHAT is
 * waiting and HOW to settle it - the exact command or the exact tab. It is derived, never stored: it reads the
 * state as it stands and writes nothing, so the status page, the goal page and the final report cannot disagree
 * about what the owner still owes.
 */
/** The `needUser` kinds that are genuinely a person's to settle; every other kind is a mechanical state of an op. */
export const OWNER_LINE_KINDS=['validator','authority','environment','decision','credential','ledger'];
/** The one command that puts a credential into custody, when the ask op's own question does not spell it out. */
export const IDENTITY_SET_COMMAND='node <skill root>/bin/starci.mjs identity set <slug> --name <VAR>';
const OWNER_ITEM_KIND={ledger:'ledger',decision:'decision'};
const clipTo=(value,max=220)=>{const text=String(value??'').replace(/\s+/g,' ').trim();return text.length>max?`${text.slice(0,max)}...`:text;};
/** Typed credential asks use the workflow's input surface; legacy questions retain classification by their words. */
const asksForCredential=op=>Boolean(op?.credential)||op?.question?.stop==='credential'||String(op?.question?.kind??'')==='credential'||credentialNeed(`${op?.question?.text??''}\n${op?.goal??''}`);

/**
 * A line on the owner's list that is really a mechanical state of the runtime, and the reason it is one. Two
 * shapes, because these are the two the owner was handed work for that the kernel had already taken:
 *
 * - `ledger incomplete: <node> declares no write scope` while a `work.author` op is authoring that very record.
 *   The record is being completed right now; the owner is asked only when that author op blocks.
 * - an `environment` line about an op that has since started running or finished. The environment it named is
 *   evidently there.
 *
 * A superseded author op is no op at all: the line is the owner's again.
 */
export function mechanicalOwnerLine(state,item){
  const ops=Array.isArray(state?.ops)?state.ops:[];
  if(item?.kind==='ledger'&&item.node){
    const author=ops.find(op=>op.kind===AUTHOR_KIND&&op.nodeId===item.node&&op.refusal!=='superseded')??null;
    return author&&author.status!=='blocked'?{node:item.node,op:author.id,reason:'an author op is on it'}:null;
  }
  if(item?.kind==='environment'&&item.op){
    const op=ops.find(entry=>entry.id===item.op)??null;
    return op&&['running','done'].includes(op.status)?{node:op.nodeId??null,op:op.id,reason:`its op is ${op.status}`}:null;
  }
  return null;
}

/**
 * Everything waiting on the owner, in one list. Three sources, one shape - `{kind, op, what, how, terminal, since}`:
 *
 * - a live `provision.ask`: it is sitting in its own tab waiting for a word, so `how` names that tab and the one
 *   command that puts the thing into custody. Never a value: the op checks presence only.
 * - an unanswered `state.provisional` entry: the runtime took its own recommendation and carried on, so `how` is
 *   the exact `workflow-answer` command that confirms or overturns it.
 * - a `needUser` line that is genuinely a person's (`OWNER_LINE_KINDS`), minus the mechanical ones.
 *
 * `what` is free text and always goes through `redactSecrets`. `how` never does, and must not: it is built from
 * ids and a command shape, and the masker - which cannot tell a long id from a key - turned `--id <workflow>`
 * into `--id [redacted]`, handing the owner a command they could not run. Nothing that could carry a value ever
 * reaches it: the identity command is matched off the question by a pattern that stops at the variable name, and
 * the ask op reports presence only, so a value is not in the question in the first place.
 */
export function ownerItems(state){
  const ops=Array.isArray(state?.ops)?state.ops:[];
  const byId=id=>ops.find(op=>op.id===id)??null;
  const items=[];
  for(const op of ops.filter(item=>item.kind===PROVISION_ASK&&liveStatus.includes(item.status))){
    const credential=asksForCredential(op);
    if(credential&&!op.credential?.ready)continue;
    items.push({kind:'provision',op:op.id,
      what:redactSecrets(clipTo(op.question?.text??op.goal??'')),
      how:credential
        ?askFillLine(op)
        :`reply \`provided\` in tab ${op.terminal??'(no tab yet)'} once it exists`,
      terminal:op.terminal??null,since:Number.isFinite(op.launchedAt)?op.launchedAt:null});
  }
  for(const entry of (state?.provisional??[]).filter(item=>!item.answered)){
    const chosen=entry.options?.[entry.recommended-1]??null;
    const ask=byId(entry.op);
    items.push({kind:'decision',op:entry.op,
      what:redactSecrets(clipTo(`${entry.decision}: the runtime took option ${entry.recommended}${chosen?` - ${chosen}`:''} and carried on`)),
      how:answerCommand(state,entry.op),
      terminal:ask?.terminal??null,since:Number.isFinite(entry.at)?entry.at:null});
  }
  const seen=new Set(items.map(item=>`${item.kind}|${item.op??''}`));
  for(const line of state?.needUser??[]){
    if(!OWNER_LINE_KINDS.includes(line?.kind))continue;
    if(mechanicalOwnerLine(state,line))continue;
    const kind=OWNER_ITEM_KIND[line.kind]??'blocked';
    const key=`${kind}|${line.op??line.node??''}`;
    if(seen.has(key))continue;
    seen.add(key);
    const op=line.op?byId(line.op):null;
    items.push({kind,op:line.op??line.node??null,
      what:redactSecrets(clipTo(line.detail??line.kind)),
      how:line.kind==='decision'&&line.op?answerCommand(state,line.op)
        :line.node?`complete the Work record of ${line.node}, then \`starci workflow-approve --id ${state?.id}\``
        :line.op?`settle what \`${line.op}\` names, then \`starci workflow-approve --id ${state?.id}\` to re-admit it`
        :`nothing in the runtime settles this one: \`starci workflow-status --id ${state?.id}\` prints the whole line`,
      terminal:op?.terminal??null,since:Number.isFinite(line.at)?line.at:null});
  }
  return items;
}

/** The list as a page section, for every page the owner reads. Empty is said out loud, never left out. */
export function ownerSection(items){
  const list=Array.isArray(items)?items:[];
  if(!list.length)return ['## Owner (0)','nothing is waiting on you'];
  return [`## Owner (${list.length})`,
    ...list.flatMap(item=>[`- ${item.kind} ${item.op??'-'}${item.terminal?` (tab ${item.terminal})`:''}: ${item.what}`,
      `  how: ${item.how}`])];
}
export const ownerLines=state=>ownerSection(ownerItems(state));
/**
 * What the owner is waiting on, as one short stable string: the event fires when this changes, never every tick.
 * Hashed rather than kept whole, because it is saved on the state at every tick and the list itself can be pages.
 */
export const ownerDigest=items=>createHash('sha1')
  .update((Array.isArray(items)?items:[]).map(item=>`${item.kind}|${item.op??''}|${item.what}`).join('\n')).digest('hex').slice(0,16);
/**
 * `owner-list` is appended when - and only when - the list the owner would read changes. A kernel that ran for a
 * day once wrote the same six lines on every iteration; the digest is what keeps the log a record of changes.
 */
export function noteOwnerList(store,state){
  const items=ownerItems(state);
  // An empty list is `null`, not the hash of nothing: a workflow that has never owed the owner anything writes
  // no `owner-list` at all, and the first one that does is the news. Emptying a list that had items still is.
  const digest=items.length?ownerDigest(items):null;
  if(digest===(state.ownerDigest??null))return null;
  state.ownerDigest=digest;
  store.appendEvent({event:'owner-list',items:items.map(item=>({kind:item.kind,op:item.op}))});
  return items;
}
/**
 * An operation that is waiting for the OWNER has no deadline: a `provision.ask` waits in its tab as long as the
 * owner takes, and a `decision.prepare` whose tab is kept is showing the question to nobody's schedule but the
 * owner's. `op-overrun` exists for a runtime that went away, and killing the one tab that asks the owner for a
 * credential because they went to lunch is exactly the failure this whole list was written against.
 */
export function waitsForOwner(state,op){
  return op?.kind===PROVISION_ASK||keepsAskTab(state,op);
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
