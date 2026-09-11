const CONTEXT_SCHEMA='starci/approval-context@1';
const DECISION_SCHEMA='starci/approval-decision@1';
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const uniqueStrings=value=>Array.isArray(value)&&value.every(item=>typeof item==='string'&&item.trim())&&new Set(value).size===value.length;

export function validateApprovalPolicy(policy){
  const errors=[];
  if(!plain(policy)||policy.schema!=='starci/approval-policy@1')errors.push('Unsupported approval policy');
  if(policy?.entry?.decision!=='need-user'||policy?.entry?.checkpoint!=='workflow-brief')errors.push('Workflow entry must require one user brief');
  if(!uniqueStrings(policy?.entry?.requiredBriefFields))errors.push('Approval policy needs unique brief fields');
  if(!uniqueStrings(policy?.preBriefAutoActions))errors.push('Approval policy needs pre-brief read-only actions');
  if(policy?.withinAcceptedBrief?.decision!=='auto'||!uniqueStrings(policy?.withinAcceptedBrief?.actions))errors.push('Accepted-brief auto actions are invalid');
  if(policy?.needUser?.decision!=='need-user'||!uniqueStrings(policy?.needUser?.triggers))errors.push('need-user triggers are invalid');
  if(!uniqueStrings(policy?.fallback?.autoReasons)||policy?.fallback?.requiredEffectState!=='none')errors.push('Fallback approval policy is invalid');
  if(!uniqueStrings(policy?.invariants))errors.push('Approval invariants are invalid');
  return {ok:errors.length===0,errors};
}

function validateContext(context){
  if(!plain(context)||context.schema!==CONTEXT_SCHEMA||!plain(context.brief)||!plain(context.action))throw Error('Invalid approval decision context');
  const {brief,action}=context;
  if(!['missing','presented','accepted','superseded'].includes(brief.status))throw Error('Invalid brief status');
  if(brief.digest!==null&&!/^[a-f0-9]{64}$/.test(brief.digest??''))throw Error('Invalid brief digest');
  for(const field of ['allowedActions','repositories','scopes','reservedCheckpoints'])if(!uniqueStrings(brief[field]))throw Error(`Invalid brief ${field}`);
  if(typeof action.type!=='string'||!action.type.trim()||!['none','known-within-brief','partial','unknown'].includes(action.effectState))throw Error('Invalid approval action');
  for(const field of ['repository','scope','fallbackReason'])if(action[field]!==undefined&&action[field]!==null&&(typeof action[field]!=='string'||!action[field].trim()))throw Error(`Invalid action ${field}`);
  for(const field of ['materialGoalChange','businessOrSrsChange','scopeExpansion','repositoryExpansion','ownershipExpansion','missingSecretOrCredential','unresolvedBusinessAlternatives','safetyBlocked'])if(action[field]!==undefined&&typeof action[field]!=='boolean')throw Error(`Invalid action ${field}`);
  return context;
}

const result=(decision,reason,context)=>({
  schema:DECISION_SCHEMA,
  decision,
  reason,
  briefDigest:context.brief.digest,
  action:context.action.type,
  repository:context.action.repository??null,
  scope:context.action.scope??null
});

/** Decide procedure versus human boundary. This validates declared facts; it cannot authenticate a user reply. */
export function decideApproval(policy,input){
  const checked=validateApprovalPolicy(policy);if(!checked.ok)throw Error(checked.errors.join('; '));
  const context=validateContext(input),{brief,action}=context;
  if(policy.preBriefAutoActions.includes(action.type)&&action.effectState==='none'&&!action.safetyBlocked)return result('auto','pre-brief-read-only',context);
  if(brief.status!=='accepted'||!brief.digest)return result('need-user','missing-or-unaccepted-brief',context);
  const material=[
    ['materialGoalChange','material-goal-change'],['businessOrSrsChange','business-or-srs-change'],
    ['scopeExpansion','scope-expansion'],['repositoryExpansion','repository-expansion'],
    ['ownershipExpansion','ownership-expansion'],['missingSecretOrCredential','missing-secret-or-credential'],
    ['unresolvedBusinessAlternatives','unresolved-business-alternatives'],['safetyBlocked','safety-block']
  ].find(([field])=>action[field]===true);
  if(material)return result('need-user',material[1],context);
  if(['partial','unknown'].includes(action.effectState))return result('need-user','partial-or-unknown-effects',context);
  if(brief.reservedCheckpoints.includes(action.type))return result('need-user','reserved-user-checkpoint',context);
  if(!policy.withinAcceptedBrief.actions.includes(action.type)||!brief.allowedActions.includes(action.type))return result('need-user','action-outside-effect-ceiling',context);
  if(action.repository&&!brief.repositories.includes(action.repository))return result('need-user','repository-expansion',context);
  if(action.scope&&!brief.scopes.includes(action.scope))return result('need-user','scope-expansion',context);
  if(action.type==='fallback.no-effects'){
    if(action.effectState!==policy.fallback.requiredEffectState)return result('need-user','fallback-after-effects',context);
    if(!policy.fallback.autoReasons.includes(action.fallbackReason))return result('need-user','fallback-reason-not-automatic',context);
  }
  return result('auto','within-accepted-brief',context);
}
