import fs from 'node:fs';
import {addOp,firstLine,liveStatus,locateSharedTreePaths,need,slash,unique,validateCommandAt} from './common.mjs';

/**
 * The owner loop, in one file, because it is one rule: the runtime prepares a decision and the owner takes it.
 * It was written inside the 318 KB kernel and read like three unrelated helpers; here the three seams of the
 * loop stand next to each other - open the question, prepare the answer, deliver the owner's ruling - and the
 * one thing they all say is visible at a glance: the kernel never answers for the owner.
 */
export const OWNER_ASK='owner.ask';
/** Whether a blocker detail names a credential or a configuration the environment must provide. */
export function credentialNeed(detail){
  const text=String(detail??'');
  return /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){1,}\b/.test(text)||/\b(api[ -]?key|token|secret|credential|password|client[ -]?id|webhook|oauth)\b/i.test(text);
}
/** The decision folder of the feature an op belongs to, in the tree's own spelling. */
export function decisionAllowlistFor(state,op){
  const paths=[...(op.ledgerIds??[]),op.nodeId??''].map(id=>String(id)).filter(Boolean);
  const feature=(()=>{
    for(const id of paths){const m=id.match(/^[^.]+\.([^.]+)\./);if(m)return m[1];}
    for(const entry of op.allowlist??[]){const m=slash(entry).match(/features\/([^/]+)\//);if(m)return m[1];}
    return null;
  })();
  return feature?[`.starciwork/features/${feature}/business/srs/decisions/**`]:['.starciwork/decisions/**'];
}
/**
 * A question only the owner can answer pauses the op that asked and opens one `owner.ask` op that prepares the
 * decision: a decided record that settles it answers it (`answered-from`), otherwise a decision record draft
 * with options and a recommendation waits for `workflow-answer`. The kernel never answers such a question
 * itself: the supervisor model used to, and the owner was never asked for a Zalo or Telegram key all day.
 */
export function openOwnerAsk(store,state,op,question,ctx,report=null){
  const same=state.ops.find(item=>item.kind===OWNER_ASK&&liveStatus.includes(item.status)&&item.question?.text===question.text);
  const ask=same??addOp(store,state,{kind:OWNER_ASK,nodeId:null,
    goal:`Prepare the owner's decision on the question ${op.id} asked: ${firstLine(question.text)}`,
    question:{...question,from:op.id},ledgerIds:[],allowlist:decisionAllowlistFor(state,op),
    references:unique([...(op.references??[])]),checks:ctx?.work?.at?.workRoot?[{name:'work-tree-validates',command:validateCommandAt(ctx.work.at.workRoot)}]:[],
    acceptance:[`the question is either answered from a decided record (\`answered-from: <id>\`) or drafted as one decision record with numbered options and one recommendation`],
    origin:'ask',requesters:[op.id]},`question of ${op.id} for the owner`);
  if(!same&&ctx?.work)locateSharedTreePaths(ask,ctx);
  if(same)same.requesters=unique([...(same.requesters??[]),op.id]);
  const file=op.dispatch?store.reportPath(op.dispatch):null;
  if(file&&fs.existsSync(file))fs.renameSync(file,`${file}.asked-${op.reports.length}`);
  op.status='paused';op.waitingFor=ask.id;op.dispatch=null;op.terminal=null;op.nudged=false;
  store.appendEvent({event:'owner-ask-opened',op:op.id,ask:ask.id,kind:question.kind,question:firstLine(question.text)});
  return 'owner-ask';
}
/**
 * The ask op reported: `answered-from` is the answer, handed to every requester in its next contract; a
 * `decision:` record is the owner's question, listed for them until `workflow-answer` comes.
 */
export function settleOwnerAsk(store,state,ask,report){
  const summary=String(report.summary??'');
  const answered=summary.match(/^\s*answered-from:\s*(\S+)\s*\n?([\s\S]*)$/);
  const requesters=state.ops.filter(item=>(ask.requesters??[]).includes(item.id));
  if(answered){
    for(const requester of requesters)resumeWithAnswer(store,state,requester,`Answered from the decided record ${answered[1]}: ${answered[2].trim()||'see that record'}`);
    store.appendEvent({event:'owner-ask-answered-from-record',ask:ask.id,record:answered[1],requesters:requesters.map(item=>item.id)});
    return;
  }
  const record=(summary.match(/^\s*decision:\s*(\S+)/)??[])[1]??null;
  const options=ask.question?.options?.length?ask.question.options:(summary.match(/^\s*\d+\.\s.+$/gm)??[]).map(line=>line.replace(/^\s*\d+\.\s*/,''));
  state.needUser.push({op:ask.id,kind:'decision',detail:`${ask.question?.text??ask.goal} - answer with workflow-answer --id ${state.id} --op ${ask.id} --choice <n> [--note "..."]${record?` (decision record ${record})`:''}`,record,options,requesters:requesters.map(item=>item.id)});
  store.appendEvent({event:'owner-question',ask:ask.id,record,options:options.length,requesters:requesters.map(item=>item.id)});
}
export function resumeWithAnswer(store,state,op,answer){
  op.answer=answer;op.status='ready';op.waitingFor=null;op.dispatch=null;op.terminal=null;op.nudged=false;op.attempt+=1;
  store.appendEvent({event:'owner-answer-delivered',op:op.id,answer:firstLine(answer)});
}
/**
 * The owner's answer (`workflow-answer`): recorded on the ask op, delivered to every requester, the question gone.
 *
 * A reconciliation conflict is the owner's question too, and the op that raised it is the intake that wrote the
 * decision record, not an `owner.ask`. The decision item on the list is what names that op, so the same command
 * answers both: the answer is recorded on the item's own record and the item goes. Only a requester that is
 * still waiting is resumed there - the intake itself is already accepted, and re-running it would undo the
 * reconciliation the owner just settled.
 */
export function answerOwnerQuestion(store,state,{op:askId,choice=null,note=null}){
  const ask=state.ops.find(item=>item.id===askId&&item.kind===OWNER_ASK)??null;
  const item=state.needUser.find(entry=>entry.op===askId&&entry.kind==='decision')??null;
  const raiser=ask??(item?state.ops.find(entry=>entry.id===askId)??null:null);
  need(raiser,`No owner question ${askId} in workflow ${state.id}`);
  const options=item?.options??raiser.question?.options??[];
  const picked=choice!==null&&choice!==undefined&&String(choice).trim()?options[Number(choice)-1]??String(choice):null;
  need(picked||String(note??'').trim(),'workflow-answer needs --choice <n> or --note "<answer>"');
  const question=ask?(ask.question?.text??ask.goal):(item?.detail??raiser.goal);
  const answer=`The owner decided on "${firstLine(question)}": ${picked?`option ${choice} - ${picked}`:''}${picked&&note?'; ':''}${note??''}`.trim();
  const decided={choice:picked?String(choice):null,note:note??null,at:Date.now()};
  const requesters=ask?(ask.requesters??[]):(item?.requesters??[]);
  if(ask)ask.answer=decided;
  else raiser.decisions=[...(raiser.decisions??[]),{record:item?.record??null,...decided,answer}];
  state.needUser=state.needUser.filter(entry=>!(entry.op===raiser.id&&entry.kind==='decision'));
  for(const requester of state.ops.filter(candidate=>requesters.includes(candidate.id))){
    if(!ask&&!liveStatus.includes(requester.status))continue;
    resumeWithAnswer(store,state,requester,answer);
  }
  store.appendEvent({event:'owner-answered',ask:raiser.id,choice:decided.choice,note:note??null,
    ...(ask?{}:{record:item?.record??null}),requesters:[...requesters]});
  return {ask:raiser.id,answer};
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
  op.status='blocked';
  state.needUser.push({op:op.id,kind:'authority',detail:report.question?.text??'the operation asked a question the kernel cannot answer'});
  return 'escalate-to-user';
}
