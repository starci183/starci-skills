// Version 2 validates scoped SRS coverage and design reasoning, never prose truth.
export function validateSRSDetails(spec, {check, shape, refs, rows, ids, text, contract}) {
  const strings = (v, at, nonempty = true) => check(Array.isArray(v) && (!nonempty || v.length > 0) && v.every(text), at + ': text array required');
  if (shape(spec.context, contract.context, 'context')) {
    for (const key of ['purpose','scope','dataScope','interfaceScope']) check(text(spec.context[key]), 'context.' + key);
    for (const key of ['assumptions','externalConstraints']) strings(spec.context[key], 'context.' + key, false);
    check(Array.isArray(spec.context.glossary), 'context.glossary');
    for (const term of spec.context.glossary ?? []) if (shape(term, ['term','meaning'], 'glossary')) check(text(term.term) && text(term.meaning), 'glossary meaning');
  }
  for (const requirement of rows('requirements')) check(['FR','BR','NFR'].includes(requirement.kind), 'requirement kind must be FR, BR or NFR');
  check(rows('requirements').some(r => r.kind === 'FR'), 'SRS needs functional requirements');
  check(rows('requirements').some(r => r.kind === 'NFR'), 'SRS needs observable quality requirements');
  const actor = (value, at, system = false) => check(ids.actors.has(value) || (system && value === 'system'), at + ': actor must resolve');
  const businessRules = (list, at) => {
    refs(list, 'requirements', at, false);
    check(list?.every(id => rows('requirements').some(r => r.id === id && r.kind === 'BR')), at + ': rule must be a BR');
  };
  for (const data of rows('data')) {
    strings(data.states, data.id + '.states');
    const names = new Set();
    for (const field of data.attributes ?? []) if (shape(field, ['name','meaning','validation','sensitivity'], data.id + '.attribute')) {
      check(Object.values(field).every(text) && !names.has(field.name), 'data attribute identity/meaning'); names.add(field.name);
    }
    check(Array.isArray(data.attributes) && data.attributes.length > 0, 'data attributes required');
    for (const transition of data.transitions ?? []) if (shape(transition, ['from','to','trigger','ruleIds'], data.id + '.transition')) {
      check(data.states.includes(transition.from) && data.states.includes(transition.to) && text(transition.trigger), 'data transition must resolve states');
      businessRules(transition.ruleIds, data.id);
    }
  }
  for (const boundary of rows('externalInterfaces')) actor(boundary.actorId, boundary.id);
  for (const flow of rows('flows')) {
    actor(flow.actor, flow.id);
    refs(flow.supportingActors, 'actors', flow.id, false);
    refs(flow.requirementIds, 'requirements', flow.id);
    check(flow.requirementIds?.some(id => rows('requirements').some(r => r.id === id && r.kind === 'FR')), 'flow must serve a functional requirement');
    businessRules(flow.ruleIds, flow.id);
    strings(flow.preconditions, flow.id + '.preconditions');
    strings(flow.inputs, flow.id + '.inputs');
    strings(flow.postconditions, flow.id + '.postconditions');
    strings(flow.failurePostconditions, flow.id + '.failurePostconditions');
    const mainIds = new Set((flow.steps ?? []).map(s => s?.id));
    const allStepIds = new Set(mainIds), branchIds = new Set();
    const flowAcceptance = (list, at) => {
      refs(list, 'acceptance', at);
      check(list?.every(id => flow.acceptanceIds?.includes(id) && rows('acceptance').some(a => a.id === id && a.flowIds?.includes(flow.id))), at + ': acceptance must belong to this flow');
    };
    const stepCheck = step => {
      actor(step.actor, flow.id + '.' + step.id, true);
      flowAcceptance(step.acceptanceIds, step.id);
    };
    for (const step of flow.steps ?? []) stepCheck(step);
    flowAcceptance(flow.acceptanceIds, flow.id);
    for (const key of ['alternatives','exceptions']) {
      check(Array.isArray(flow[key]), flow.id + '.' + key);
      if (!flow[key]?.length) check(text(flow.branchReview?.[key]), flow.id + ': explain no ' + key);
      for (const branch of flow[key] ?? []) {
        if (!shape(branch, contract.branch, flow.id + '.' + key)) continue;
        check(text(branch.id) && !branchIds.has(branch.id), 'branch id must be unique'); branchIds.add(branch.id);
        check(mainIds.has(branch.fromStep) && (branch.resumeAt === 'end' || mainIds.has(branch.resumeAt)), 'branch entry/resume must resolve main steps or end');
        check(text(branch.condition), 'branch condition required');
        check(Array.isArray(branch.steps) && branch.steps.length > 0, 'branch must contain ordered steps');
        strings(branch.postconditions, branch.id + '.postconditions');
        flowAcceptance(branch.acceptanceIds, branch.id);
        for (const step of branch.steps ?? []) {
          if (!shape(step, contract.flowStep, branch.id + '.step')) continue;
          check(contract.flowStep.filter(k => k !== 'acceptanceIds').every(k => text(step[k])), 'branch step fields required');
          check(!allStepIds.has(step.id), 'branch step id must be unique in flow'); allStepIds.add(step.id);
          stepCheck(step);
        }
      }
    }
    if (shape(flow.branchReview, ['alternatives','exceptions'], flow.id + '.branchReview')) check(Object.values(flow.branchReview).every(text), 'branch applicability rationale required');
    for (const requirementId of flow.requirementIds ?? []) check(rows('acceptance').some(a => flow.acceptanceIds?.includes(a.id) && a.requirementIds?.includes(requirementId)), 'flow requirement needs linked acceptance: ' + requirementId);
  }
  for (const requirement of rows('requirements')) {
    for (const id of requirement.acceptanceIds ?? []) check(rows('acceptance').some(a => a.id === id && a.requirementIds?.includes(requirement.id)), 'requirement acceptance must link back: ' + requirement.id);
    if (requirement.kind === 'FR') check(rows('flows').some(f => f.requirementIds?.includes(requirement.id)), 'FR missing detailed flow: ' + requirement.id);
  }
  for (const ac of rows('acceptance')) {
    for (const id of ac.requirementIds ?? []) check(rows('requirements').some(r => r.id === id && r.acceptanceIds?.includes(ac.id)), 'acceptance requirement must link back: ' + ac.id);
    for (const id of ac.flowIds ?? []) check(rows('flows').some(f => f.id === id && f.acceptanceIds?.includes(ac.id)), 'acceptance flow must link back: ' + ac.id);
  }
}

export function validateArchitectureReview(spec, {check, shape, refs, rows, text, contract}) {
  const review = spec.architectureReview;
  if (!shape(review, contract.review, 'architectureReview')) return;
  check(text(review.context), 'architecture review needs actual problem context');
  check(Array.isArray(review.evidenceLimitations) && review.evidenceLimitations.length > 0 && review.evidenceLimitations.every(text), 'architecture review must distinguish design from executed proof');
  if (shape(review.challenge, ['proposal','simplerAlternative','tradeoffs','decision','reason'], 'architecture challenge')) check(Object.values(review.challenge).every(text), 'architecture challenge needs a justified decision');
  const seen = new Set();
  const decision = (id, at) => {
    refs([id], 'decisions', at);
    const d = rows('decisions').find(x => x.id === id);
    if (spec.status === 'pass') check(d?.status === 'accepted', 'unresolved architecture review decision: ' + at);
  };
  check(Array.isArray(review.concerns) && review.concerns.length > 0, 'architecture needs context-selected concerns');
  for (const concern of review.concerns ?? []) {
    if (!shape(concern, contract.concern, 'architecture concern')) continue;
    check(text(concern.id) && !seen.has(concern.id), 'architecture concern id'); seen.add(concern.id);
    check(text(concern.concern) && text(concern.rationale), 'concern needs applicability rationale');
    refs(concern.requirementIds, 'requirements', concern.id); refs(concern.sourceRefs, 'sources', concern.id);
    decision(concern.decisionId, concern.id);
    check(Array.isArray(concern.scenarios) && concern.scenarios.length > 0, 'concern needs concrete scenarios');
    const scenarioIds = new Set();
    for (const scenario of concern.scenarios ?? []) {
      if (!shape(scenario, contract.scenario, 'architecture scenario')) continue;
      check(text(scenario.id) && !scenarioIds.has(scenario.id), 'architecture scenario id'); scenarioIds.add(scenario.id);
      check(['trigger','impact','control','owner'].every(k => text(scenario[k])), 'architecture scenario needs trigger/impact/control/owner');
      refs(scenario.acceptanceIds, 'acceptance', scenario.id);
      check(scenario.acceptanceIds?.every(id => rows('acceptance').some(a => a.id === id && a.requirementIds?.some(r => concern.requirementIds?.includes(r)))), 'scenario must verify its concern requirements');
    }
  }
  check(Array.isArray(review.residualRisks), 'residual risk array required');
  const riskIds = new Set();
  for (const risk of review.residualRisks ?? []) {
    if (!shape(risk, ['id','risk','severity','owner','decisionId'], 'residual risk')) continue;
    check(text(risk.id) && !riskIds.has(risk.id), 'residual risk id'); riskIds.add(risk.id);
    check(text(risk.risk) && text(risk.owner) && ['low','medium','high','critical'].includes(risk.severity), 'residual risk ownership/severity');
    decision(risk.decisionId, risk.id);
  }
}
