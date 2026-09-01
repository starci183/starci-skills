import crypto from 'node:crypto';

const contentFingerprint = (value) => `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
const canonicalValue = (value) => Array.isArray(value)
  ? value.map(canonicalValue)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]))
    : value;
const sameValue = (left, right) => JSON.stringify(canonicalValue(left)) === JSON.stringify(canonicalValue(right));

function sameSequence(left, right) {
  left ??= [];
  right ??= [];
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

const GOVERNANCE_FIELDS = ['grammarBinding', 'iconographyManifest', 'mediaManifest', 'productFamilyEvidence'];

function blindGrammarBinding(binding) {
  if (!binding) return binding;
  return {
    bindingRef: binding.bindingRef,
    manifestRef: binding.manifestRef,
    decisionManifestFingerprint: binding.decisionManifestFingerprint,
    auditPlanRef: binding.auditPlanRef,
    auditPlanFingerprint: binding.auditPlanFingerprint,
  };
}

function blindIconographyManifest(manifest) {
  if (!manifest) return manifest;
  return {
    manifestRef: manifest.manifestRef,
    manifestFingerprint: manifest.manifestFingerprint,
    mode: manifest.mode,
    visualFamilyRef: manifest.visualFamilyRef,
  };
}

function blindMediaManifest(manifest) {
  if (!manifest) return manifest;
  return {
    manifestRef: manifest.manifestRef,
    manifestFingerprint: manifest.manifestFingerprint,
    mode: manifest.mode,
    assetRef: manifest.assetRef,
  };
}

function manifestFromVisualPacket(packet) {
  return {
    packetRef: packet.packetRef,
    preflightRef: packet.preflightRef,
    matrixRef: packet.matrixRef,
    matrixFingerprint: packet.matrixFingerprint,
    partitionFingerprint: packet.partitionFingerprint,
    visualRound: packet.visualRound,
    capturePartitionRefs: packet.capturePartitionRefs,
    reusedPartitionRefs: packet.reusedPartitionRefs,
    grammarBinding: packet.grammarBinding,
    iconographyManifest: packet.iconographyManifest,
    mediaManifest: packet.mediaManifest,
    productFamilyEvidence: packet.productFamilyEvidence,
    latestMutationFingerprint: packet.latestMutationFingerprint,
    capturedSourceFingerprint: packet.capturedSourceFingerprint,
    latestMutationAt: packet.latestMutationAt,
    capturedAt: packet.capturedAt,
    rasterCells: packet.rasterCells,
    probeCells: packet.probeCells,
    lastScreenshotRef: packet.lastScreenshotRef,
  };
}

export function createOperatorInvocationBindingRegistry() {
  const validatedCompiles = new Map();
  const validatedDirections = new Map();
  const validatedSourceApplications = new Map();
  const grammarRepairs = new Map();
  const directionSelections = new Map();
  const uatStageReceipts = new Map();
  const qualityStageReceipts = new Map();
  const visualPasses = new Map();
  const qualityPasses = new Map();
  const validatedCapturePackets = new Map();
  const validatedPreflights = new Map();

  function record(operatorId, outputDocument, returnReceipt) {
    if (operatorId === 'fe/visual-fidelity' && outputDocument?.output?.outcome === 'passed') {
      visualPasses.set(returnReceipt.missionId, {
        receiptId: returnReceipt.receiptId,
        missionId: returnReceipt.missionId,
        returnedAt: returnReceipt.timestamp,
        reviewerExecutionRef: returnReceipt.trace?.aiActivity?.executionRef,
        sourceFingerprint: returnReceipt.trace.input.input.blindReviewPacket.capturedSourceFingerprint,
        evidenceFingerprint: outputDocument.output.result.packetFingerprint,
        artifactRefs: outputDocument.output.result.artifactRefs,
        result: outputDocument.output.result,
      });
      return;
    }
    if (['quality/readiness-inventory','quality/rule-binding-check'].includes(operatorId)) {
      qualityStageReceipts.set(returnReceipt.receiptId, {
        receiptId:returnReceipt.receiptId,
        missionId:returnReceipt.missionId,
        operatorId,
        returnedAt:returnReceipt.timestamp,
        input:returnReceipt.trace.input,
        output:outputDocument.output,
        sourceHeads:returnReceipt.trace.sourceHeads,
      });
      return;
    }
    if (operatorId === 'quality/delivery-proof' && outputDocument?.output?.outcome === 'pass') {
      qualityPasses.set(returnReceipt.missionId, {
        receiptId: returnReceipt.receiptId,
        missionId: returnReceipt.missionId,
        sourceFingerprint: returnReceipt.trace.input.input.sourceFingerprint,
        evidenceRefs: outputDocument.output.evidenceRefs,
        sourceHeads: returnReceipt.trace.sourceHeads,
      });
      return;
    }
    if (['test/uat-snapshot-freeze','test/uat-case-freeze','test/uat-behavior-proof','test/uat-ux-proof','test/uat-ui-proof'].includes(operatorId)) {
      uatStageReceipts.set(returnReceipt.receiptId, {
        receiptId: returnReceipt.receiptId,
        missionId: returnReceipt.missionId,
        operatorId,
        returnedAt: returnReceipt.timestamp,
        input: returnReceipt.trace.input,
        output: outputDocument.output,
      });
      return;
    }
    if (operatorId === 'fe/request-compile' && outputDocument?.output?.outcome === 'compiled') {
      const result = outputDocument.output.result;
      const frozen = { receiptId: returnReceipt.receiptId, missionId: returnReceipt.missionId, result };
      const prior = validatedCompiles.get(result.compiledRequestRef);
      if (prior && JSON.stringify(prior.result) !== JSON.stringify(result)) throw new Error('compiled request identity was already bound to a different author-once contract');
      validatedCompiles.set(result.compiledRequestRef, frozen);
      const repair = grammarRepairs.get(`${returnReceipt.missionId}:${result.targetRef}`);
      if (repair && repair.result.publishedGrammar.packageRef === result.grammarBinding.packageRef && repair.result.afterAuthorityRevision === result.grammarBinding.authorityRevision) repair.consumed = true;
      return;
    }
    if (operatorId === 'fe/authority-reconcile' && outputDocument?.output?.outcome === 'reconciled') {
      const result = outputDocument.output.result;
      grammarRepairs.set(`${returnReceipt.missionId}:${returnReceipt.trace.input.input.targetRef}`, { receiptId: returnReceipt.receiptId, missionId: returnReceipt.missionId, result, consumed: false });
      return;
    }
    if (operatorId === 'fe/direction-generate' && outputDocument?.output?.outcome === 'generated') {
      const result = outputDocument.output.result;
      validatedDirections.set(returnReceipt.receiptId, { receiptId: returnReceipt.receiptId, missionId: returnReceipt.missionId, result });
      return;
    }
    if (operatorId === 'fe/source-apply' && outputDocument?.output?.outcome === 'applied') {
      const result = outputDocument.output.result;
      validatedSourceApplications.set(returnReceipt.receiptId, {
        receiptId: returnReceipt.receiptId,
        missionId: returnReceipt.missionId,
        compiledRequestRef: result.compiledRequestRef,
        aggregateAfterFingerprint: result.aggregateAfterFingerprint,
        effects: result.effectRecords,
        at: returnReceipt.timestamp,
        result,
      });
      return;
    }
    if (operatorId === 'fe/capture-preflight' && outputDocument?.output?.outcome === 'ready') {
      const result = outputDocument.output.result;
      const frozen = {
        receiptId: returnReceipt.receiptId,
        preflightRef: result.preflightRef,
        compiledRequestRef: result.compiledRequestRef,
        compiledRequestFingerprint: result.compiledRequestFingerprint,
        sourceApplyReturnReceiptRef: result.sourceApplyReturnReceiptRef,
        aggregateAfterFingerprint: result.aggregateAfterFingerprint,
        matrixRef: result.matrixRef,
        matrixFingerprint: result.matrixFingerprint,
        partitionFingerprint: result.partitionFingerprint,
        round: result.round,
        capturePartitionRefs: result.capturePartitionRefs,
        reusedPartitionRefs: result.reusedPartitionRefs,
        grammarBinding: result.grammarBinding,
        iconographyManifest: result.iconographyManifest,
        mediaManifest: result.mediaManifest,
        productFamilyEvidence: result.productFamilyEvidence,
      };
      const prior = validatedPreflights.get(result.preflightRef);
      if (prior && !sameValue(prior, frozen)) throw new Error('validated capture preflight identity was already bound to a different freeze');
      validatedPreflights.set(result.preflightRef, frozen);
      return;
    }
    if (operatorId !== 'fe/render-capture' || outputDocument?.output?.outcome !== 'captured') return;
    const result = outputDocument.output.result;
    const packetRef = result.blindReviewPacketRef;
    const capture = {
      receiptId: returnReceipt.receiptId,
      packetFingerprint: result.blindReviewPacketFingerprint,
      sourceFingerprint: result.sourceFingerprint,
      manifest: result.blindReviewPacket,
    };
    const prior = validatedCapturePackets.get(packetRef);
    if (prior && JSON.stringify(prior) !== JSON.stringify(capture)) throw new Error('validated render-capture packet identity was already bound to different evidence');
    validatedCapturePackets.set(packetRef, capture);
  }

  function recordDirectionSelection(directionReturnReceiptRef, selection) {
    const direction = validatedDirections.get(directionReturnReceiptRef);
    if (!direction) throw new Error('direction selection requires a validated direction-generate RETURN');
    const candidate = direction.result.directions.find(({ id }) => id === selection.selectedDirectionId);
    if (!candidate) throw new Error('direction selection is not one of the validated candidates');
    const prior = directionSelections.get(directionReturnReceiptRef);
    if (prior && prior.selectedDirectionId !== selection.selectedDirectionId) throw new Error('direction selection was already bound to another candidate');
    directionSelections.set(directionReturnReceiptRef, { ...selection, candidate });
  }

  function validate(operatorId, inputDocument, outputDocument, returnReceipt = null) {
    if (['quality/readiness-inventory','quality/rule-binding-check'].includes(operatorId) && outputDocument?.output?.debtPolicy !== inputDocument?.input?.debtPolicy) {
      return ['Quality operator debtPolicy differs from the exact invocation projection'];
    }
    const qualityChainErrors=[];
    if (operatorId === 'quality/rule-binding-check') {
      const readiness=qualityStageReceipts.get(inputDocument?.context?.readinessReturnReceiptRef);
      if (!readiness || readiness.operatorId !== 'quality/readiness-inventory' || readiness.missionId !== returnReceipt?.missionId) {
        qualityChainErrors.push('Quality rule check is not bound to the validated same-mission readiness RETURN');
      } else {
        if (readiness.output.outcome !== 'green') qualityChainErrors.push('Quality rule check requires a green readiness predecessor');
        if (readiness.input.input.sourceFingerprint !== inputDocument.input.sourceFingerprint || readiness.input.input.debtPolicy !== inputDocument.input.debtPolicy || !sameValue(readiness.input.input.origin, inputDocument.input.origin)) qualityChainErrors.push('Quality rule check source, policy, or frontend origin differs from readiness');
        const required=[readiness.receiptId,readiness.output.resultRef,...readiness.output.evidenceRefs].filter(Boolean);
        if (required.some((ref)=>!inputDocument.context.contextRefs.includes(ref))) qualityChainErrors.push('Quality rule check context does not preserve the exact readiness receipt and evidence');
        if (['pass','fail'].includes(outputDocument?.output?.outcome) && required.some((ref)=>!outputDocument.output.evidenceRefs.includes(ref))) qualityChainErrors.push('Quality rule result does not preserve the exact readiness proof');
      }
    }
    if (operatorId === 'quality/delivery-proof') {
      const readiness=qualityStageReceipts.get(inputDocument?.context?.readinessReturnReceiptRef);
      const rules=qualityStageReceipts.get(inputDocument?.context?.ruleBindingReturnReceiptRef);
      if (!readiness || readiness.operatorId !== 'quality/readiness-inventory' || readiness.missionId !== returnReceipt?.missionId) qualityChainErrors.push('Quality delivery proof is not bound to the validated same-mission readiness RETURN');
      if (!rules || rules.operatorId !== 'quality/rule-binding-check' || rules.missionId !== returnReceipt?.missionId) qualityChainErrors.push('Quality delivery proof is not bound to the validated same-mission rule-binding RETURN');
      if (readiness && rules) {
        if (rules.input.context.readinessReturnReceiptRef !== readiness.receiptId) qualityChainErrors.push('Quality delivery proof predecessors are mixed from different readiness chains');
        if (readiness.output.outcome !== 'green' || rules.output.outcome !== 'pass') qualityChainErrors.push('Quality delivery PASS requires green readiness and passed rules');
        for (const stage of [readiness,rules]) {
          if (stage.input.input.sourceFingerprint !== inputDocument.input.sourceFingerprint || stage.input.input.debtPolicy !== inputDocument.input.debtPolicy || !sameValue(stage.input.input.origin,inputDocument.input.origin)) qualityChainErrors.push(`Quality delivery source, policy, or frontend origin differs at ${stage.operatorId}`);
        }
        const required=[readiness.receiptId,rules.receiptId,readiness.output.resultRef,rules.output.resultRef,...readiness.output.evidenceRefs,...rules.output.evidenceRefs].filter(Boolean);
        if (required.some((ref)=>!inputDocument.context.contextRefs.includes(ref))) qualityChainErrors.push('Quality delivery context does not preserve exact readiness and rule receipts/evidence');
        if (outputDocument?.output?.outcome === 'pass' && required.some((ref)=>!outputDocument.output.evidenceRefs.includes(ref))) qualityChainErrors.push('Quality delivery PASS does not preserve exact readiness and rule proof');
      }
    }
    if (operatorId === 'fe/progress-guard') {
      const history = inputDocument?.context?.history ?? [];
      const candidate = inputDocument?.input?.candidateFingerprint;
      const expectedOutcome = history.includes(candidate) ? 'cycle' : 'progress';
      const errors = [];
      if (outputDocument?.output?.outcome !== expectedOutcome) errors.push(`progress guard must return ${expectedOutcome} for the exact mission history`);
      if (!outputDocument?.output?.evidenceRefs?.includes(candidate)) errors.push('progress guard evidence must include the candidate progress fingerprint');
      return errors;
    }
    if (operatorId.startsWith('quality/') && inputDocument?.input?.debtPolicy === 'forbidden') {
      const visual = visualPasses.get(returnReceipt?.missionId);
      if (!visual) return ['verification-only Quality invocation requires the registered final visual PASS'];
      const supplied = new Set([...(inputDocument.context?.contextRefs ?? []), ...(inputDocument.context?.sourceRefs ?? [])]);
      const errors = [...qualityChainErrors];
      const origin = inputDocument.input.origin;
      if (!origin || origin.fromSkillId !== 'starci-fe-process') errors.push('verification-only Quality requires the typed final frontend visual PASS origin');
      if (inputDocument.input.sourceFingerprint !== visual.sourceFingerprint) errors.push('Quality invocation source differs from registered visual PASS');
      if (!supplied.has(visual.receiptId) || !supplied.has(visual.evidenceFingerprint)) errors.push('Quality invocation context must include the exact visual PASS receipt and packet fingerprint');
      const auditRefs = visual.artifactRefs.filter((ref) => /(^|[\\/])audit\.md$/.test(ref));
      if (auditRefs.length === 0 || auditRefs.some((ref) => !supplied.has(ref))) errors.push('Quality invocation context must include every final visual PASS audit artifact');
      if (origin && (origin.visualPassReturnReceiptRef !== visual.receiptId || origin.sourceFingerprint !== visual.sourceFingerprint || origin.evidenceFingerprint !== visual.evidenceFingerprint || !sameSequence(origin.auditRefs, auditRefs))) errors.push('Quality invocation origin differs from the exact registered visual PASS projection');
      if (['quality/finding-repair','quality/debt-repay'].includes(operatorId)) errors.push('verification-only Quality cannot invoke mutation or debt operators');
      if (errors.length > 0 || operatorId !== 'quality/delivery-proof' || outputDocument?.output?.outcome !== 'pass') return errors;
      if (!outputDocument.output.evidenceRefs.includes(visual.evidenceFingerprint) || auditRefs.some((ref) => !outputDocument.output.evidenceRefs.includes(ref))) errors.push('Quality PASS evidence must preserve the exact visual packet and audit artifacts');
      return errors;
    }
    if (operatorId.startsWith('quality/') && inputDocument?.input?.origin !== null) {
      return ['non-frontend Quality invocation cannot carry a frontend visual PASS origin'];
    }
    if (qualityChainErrors.length > 0) return qualityChainErrors;
    if (operatorId === 'test/uat-snapshot-freeze') {
      const quality = qualityPasses.get(returnReceipt?.missionId);
      if (!quality) return ['UAT snapshot requires the registered same-mission Quality delivery-proof PASS'];
      const errors = [];
      if (inputDocument.context.sourceFingerprint !== quality.sourceFingerprint) errors.push('UAT snapshot source differs from Quality PASS');
      if (!inputDocument.context.authorityRefs.includes(quality.receiptId)) errors.push('UAT snapshot authority must include the exact Quality PASS receipt');
      return errors;
    }
    if (operatorId === 'fe/authority-reconcile' && outputDocument?.output?.outcome === 'reconciled') {
      const errors = [];
      const context = inputDocument?.context;
      const input = inputDocument?.input;
      const result = outputDocument?.output?.result;
      if (!context || !input || !result) return ['Grammar reconciliation requires complete input and output documents'];
      if (result.owner !== input.owner || result.gapRef !== input.gapRef || result.authorityRef !== input.authorityRef) errors.push('Grammar reconciliation owner, gap, or authority differs from invocation input');
      if (result.beforeAuthorityRevision !== context.authorityRevision) errors.push('Grammar reconciliation before revision differs from invocation authority');
      if (JSON.stringify(result.authorityBoundary) !== JSON.stringify(input.authorityBoundary) || result.authorityBoundaryFingerprint !== input.authorityBoundaryFingerprint) errors.push('Grammar reconciliation boundary differs from invocation input');
      if (result.afterAuthorityRevision === result.beforeAuthorityRevision) errors.push('Grammar reconciliation must publish a changed authority revision');
      if (!result.artifactRefs.includes(result.publishedGrammar.artifactRef) || !outputDocument.output.evidenceRefs.includes(result.publishedGrammar.exportRef)) errors.push('Grammar reconciliation must register its exact published artifact and export evidence');
      return errors;
    }
    if (operatorId === 'fe/request-compile' && outputDocument?.output?.outcome === 'compiled') {
      const errors = [];
      const input = inputDocument?.input;
      const result = outputDocument?.output?.result;
      if (!input || !result) return ['compiled request requires complete input and output documents'];
      for (const field of ['targetRef', 'uxUiChangeLevel', 'directionMode']) {
        if (result[field] !== input[field]) errors.push(`compiled request ${field} differs from invocation input`);
      }
      if (!sameSequence(result.constraints, input.constraints)) errors.push('compiled request constraints differ from invocation input');
      if (JSON.stringify(result.directionEvidence) !== JSON.stringify(input.directionEvidence)) errors.push('compiled request directionEvidence differs from invocation input');
      const repair = grammarRepairs.get(`${returnReceipt?.missionId}:${result.targetRef}`);
      if (repair?.consumed) {
        errors.push('compiled request attempts to reuse an already consumed Grammar repair publication');
      } else if (repair) {
        const publication = repair.result.publishedGrammar;
        if (result.grammarBinding.packageRef !== publication.packageRef || result.grammarBinding.manifestRef !== publication.exportRef || result.grammarBinding.contentSha256 !== publication.contentSha256 || result.grammarBinding.authorityRevision !== repair.result.afterAuthorityRevision) errors.push('compiled request does not consume the exact published Grammar repair');
        if (!inputDocument.context.evidenceRefs.includes(repair.receiptId) && !inputDocument.context.evidenceRefs.includes(publication.artifactRef)) errors.push('compiled request evidence does not include the exact Grammar repair publication');
      }
      return errors;
    }
    if (operatorId === 'fe/direction-generate' && outputDocument?.output?.outcome === 'generated') {
      const errors = [];
      const context = inputDocument?.context;
      const input = inputDocument?.input;
      const output = outputDocument?.output;
      if (!context || !input || !output?.result) return ['generated direction requires complete input and output documents'];
      if (output.result.mode !== input.mode) errors.push('generated direction mode differs from invocation input');
      const compiled = validatedCompiles.get(input.compiledRequestRef);
      if (!compiled || compiled.missionId !== returnReceipt?.missionId) errors.push('generated direction is not bound to a validated same-mission compiled request');
      if (compiled) {
        if (input.compiledRequestFingerprint !== compiled.result.compiledRequestFingerprint || output.result.compiledRequestFingerprint !== compiled.result.compiledRequestFingerprint) errors.push('generated direction compiled fingerprint differs from the registered request');
        if (input.targetRef !== compiled.result.targetRef || !sameSequence(input.constraints, compiled.result.constraints)) errors.push('generated direction invocation differs from the registered compiled target or constraints');
        for (const field of GOVERNANCE_FIELDS) {
          if (!sameValue(input[field], compiled.result[field])) errors.push(`generated direction ${field} differs from the registered compiled request`);
        }
      }
      for (const field of GOVERNANCE_FIELDS) {
        if (!sameValue(output.result[field], input[field])) errors.push(`generated direction result ${field} differs from invocation input`);
      }
      if (!context.evidenceRefs.includes(input.compiledRequestRef)) errors.push('direction invocation context does not include compiledRequestRef');
      if (!output.evidenceRefs.includes(input.compiledRequestRef)) errors.push('generated direction evidence does not include compiledRequestRef');
      return errors;
    }
    if (operatorId === 'test/uat-case-freeze') {
      const snapshot = uatStageReceipts.get(inputDocument?.context?.snapshotReturnReceiptRef);
      if (!snapshot || snapshot.operatorId !== 'test/uat-snapshot-freeze' || snapshot.missionId !== returnReceipt?.missionId) return ['UAT case freeze is not bound to the validated same-mission snapshot RETURN'];
      const errors = [];
      if (snapshot.output.outcome !== 'frozen' || inputDocument.context.snapshotRef !== snapshot.output.canonicalRef) errors.push('UAT case freeze snapshot differs from the validated frozen snapshot');
      if (inputDocument.context.sourceFingerprint !== snapshot.input.context.sourceFingerprint) errors.push('UAT case freeze source differs from the frozen snapshot source');
      return errors;
    }
    if (operatorId === 'test/uat-behavior-proof') {
      const cases = uatStageReceipts.get(inputDocument?.context?.caseFreezeReturnReceiptRef);
      if (!cases || cases.operatorId !== 'test/uat-case-freeze' || cases.missionId !== returnReceipt?.missionId) return ['UAT behavior proof is not bound to the validated same-mission case freeze'];
      const errors = [];
      if (cases.output.outcome !== 'frozen' || inputDocument.context.snapshotRef !== cases.input.context.snapshotRef) errors.push('UAT behavior proof snapshot differs from frozen cases');
      if (inputDocument.context.sourceFingerprint !== cases.input.context.sourceFingerprint) errors.push('UAT behavior proof source differs from frozen cases');
      if (inputDocument.input.browserSessionRef !== cases.input.input.browserSessionRef || inputDocument.input.accountRef !== cases.input.input.accountRef) errors.push('UAT behavior proof browser or account differs from frozen cases');
      return errors;
    }
    if (operatorId === 'test/uat-ux-proof') {
      const behavior = uatStageReceipts.get(inputDocument?.context?.behaviorProofReturnReceiptRef);
      if (!behavior || behavior.operatorId !== 'test/uat-behavior-proof' || behavior.missionId !== returnReceipt?.missionId) return ['UAT UX proof is not bound to the validated same-mission behavior proof'];
      const errors = [];
      if (inputDocument.context.snapshotRef !== behavior.input.context.snapshotRef || inputDocument.context.sourceFingerprint !== behavior.input.context.sourceFingerprint) errors.push('UAT UX proof snapshot or source differs from behavior proof');
      if (inputDocument.input.browserSessionRef !== behavior.input.input.browserSessionRef || inputDocument.input.accountRef !== behavior.input.input.accountRef) errors.push('UAT UX proof browser or account differs from behavior proof');
      return errors;
    }
    if (operatorId === 'test/uat-ui-proof') {
      const ux = uatStageReceipts.get(inputDocument?.context?.uxProofReturnReceiptRef);
      if (!ux || ux.operatorId !== 'test/uat-ux-proof' || ux.missionId !== returnReceipt?.missionId) return ['UAT UI proof is not bound to the validated same-mission UX proof'];
      const errors = [];
      if (inputDocument.context.snapshotRef !== ux.input.context.snapshotRef || inputDocument.context.sourceFingerprint !== ux.input.context.sourceFingerprint) errors.push('UAT UI proof snapshot or source differs from UX proof');
      if (inputDocument.input.browserSessionRef !== ux.input.input.browserSessionRef || inputDocument.input.accountRef !== ux.input.input.accountRef) errors.push('UAT UI proof browser or account differs from UX proof');
      return errors;
    }
    if (operatorId === 'test/uat-result-publish') {
      const errors = [];
      const context = inputDocument?.context;
      const input = inputDocument?.input;
      const output = outputDocument?.output;
      if (!context || !input || !output) return ['UAT result publication requires complete input and output documents'];
      if (!sameSequence(output.evidenceRefs, input.evidenceRefs)) errors.push('UAT result evidence differs from the exact invocation evidence');
      const stageSpecs = [
        ['snapshotReturnReceiptRef','test/uat-snapshot-freeze'],
        ['caseFreezeReturnReceiptRef','test/uat-case-freeze'],
        ['behaviorProofReturnReceiptRef','test/uat-behavior-proof'],
        ['uxProofReturnReceiptRef','test/uat-ux-proof'],
        ['uiProofReturnReceiptRef','test/uat-ui-proof'],
      ];
      const stages = Object.fromEntries(stageSpecs.map(([field, expectedOperator]) => {
        const stage = uatStageReceipts.get(context[field]);
        if (!stage || stage.operatorId !== expectedOperator || stage.missionId !== returnReceipt?.missionId) errors.push(`UAT result ${field} is not the validated same-mission ${expectedOperator} RETURN`);
        return [field, stage];
      }));
      const snapshot = stages.snapshotReturnReceiptRef;
      const cases = stages.caseFreezeReturnReceiptRef;
      const behavior = stages.behaviorProofReturnReceiptRef;
      const ux = stages.uxProofReturnReceiptRef;
      const ui = stages.uiProofReturnReceiptRef;
      if (cases && cases.input.context.snapshotReturnReceiptRef !== snapshot?.receiptId) errors.push('UAT result case freeze does not descend from the selected snapshot RETURN');
      if (behavior && behavior.input.context.caseFreezeReturnReceiptRef !== cases?.receiptId) errors.push('UAT result behavior proof does not descend from the selected case-freeze RETURN');
      if (ux && ux.input.context.behaviorProofReturnReceiptRef !== behavior?.receiptId) errors.push('UAT result UX proof does not descend from the selected behavior RETURN');
      if (ui && ui.input.context.uxProofReturnReceiptRef !== ux?.receiptId) errors.push('UAT result UI proof does not descend from the selected UX RETURN');
      if (snapshot && context.snapshotRef !== snapshot.output.canonicalRef) errors.push('UAT result snapshot differs from the validated frozen snapshot');
      for (const stage of [cases,behavior,ux,ui].filter(Boolean)) {
        if (stage.input.context.snapshotRef !== context.snapshotRef) errors.push(`UAT result snapshot differs at ${stage.operatorId}`);
      }
      for (const stage of [snapshot,cases,behavior,ux,ui].filter(Boolean)) {
        const stageSource = stage.operatorId === 'test/uat-snapshot-freeze' ? stage.input.context.sourceFingerprint : stage.input.context.sourceFingerprint;
        if (stageSource !== context.sourceFingerprint) errors.push(`UAT result source differs at ${stage.operatorId}`);
      }
      for (const stage of [cases,behavior,ux,ui].filter(Boolean)) {
        if (stage.input.input.browserSessionRef !== input.browserSessionRef || stage.input.input.accountRef !== input.accountRef) errors.push(`UAT result browser or account differs at ${stage.operatorId}`);
      }
      const exactStageEvidence=[
        ...[snapshot,cases,behavior,ux,ui].filter(Boolean).map(({receiptId})=>receiptId),
        snapshot?.output?.canonicalRef,
        ...[snapshot,cases,behavior,ux,ui].filter(Boolean).flatMap(({output:stageOutput})=>[
          ...(stageOutput.evidenceRefs??[]),
          ...(stageOutput.result?.artifactRefs??[]),
        ]),
      ].filter(Boolean);
      if (exactStageEvidence.some((ref)=>!input.evidenceRefs.includes(ref))) errors.push('UAT result input does not preserve every exact stage receipt, artifact, and evidence ref');
      const lensOutcomes = [behavior?.output?.outcome, ux?.output?.outcome, ui?.output?.outcome];
      const visual = visualPasses.get(returnReceipt?.missionId);
      if (!visual || context.priorVisualPassRef !== visual.receiptId || context.priorVisualPassedAt !== visual.returnedAt) errors.push('UAT result does not identify the exact latest registered visual PASS');
      if (visual && context.sourceFingerprint !== visual.sourceFingerprint) errors.push('UAT result source differs from the latest registered visual PASS');
      if (visual && ui && !(Date.parse(ui.returnedAt) > Date.parse(visual.returnedAt))) errors.push('UAT UI proof is not fresh relative to the latest visual PASS');
      if (output.outcome === 'passed' && lensOutcomes.some((outcome) => outcome !== 'passed')) errors.push('UAT PASS requires behavior, UX, and UI all passed');
      if (output.outcome === 'frontend-counterevidence' && !(lensOutcomes[0] === 'passed' && lensOutcomes[1] === 'passed' && lensOutcomes[2] === 'failed')) errors.push('frontend counterevidence requires passed behavior and UX with a failed UI proof');
      if (output.outcome === 'failed' && !lensOutcomes.includes('failed')) errors.push('ordinary UAT failed requires at least one failed proof');
      if (output.outcome !== 'frontend-counterevidence') return errors;
      const counterevidence = output.result?.counterevidence;
      if (!counterevidence) return [...errors, 'frontend counterevidence publication requires a typed counterevidence result'];
      if (counterevidence.snapshotRef !== context.snapshotRef) errors.push('frontend counterevidence snapshot differs from the UAT invocation');
      if (counterevidence.sourceFingerprint !== context.sourceFingerprint) errors.push('frontend counterevidence source differs from the UAT invocation');
      if (counterevidence.priorVisualPassRef !== context.priorVisualPassRef) errors.push('frontend counterevidence does not descend from the exact prior visual PASS');
      if (!sameSequence(counterevidence.evidenceRefs, input.evidenceRefs)) errors.push('frontend counterevidence refs differ from the exact UAT invocation evidence');
      const expectedEvidenceFingerprint = contentFingerprint({
        snapshotRef: context.snapshotRef,
        sourceFingerprint: context.sourceFingerprint,
        priorVisualPassRef: context.priorVisualPassRef,
        priorVisualPassedAt: context.priorVisualPassedAt,
        evidenceRefs: input.evidenceRefs,
      });
      if (counterevidence.evidenceFingerprint !== expectedEvidenceFingerprint) errors.push('frontend counterevidence fingerprint does not bind the exact UAT snapshot, source, prior visual PASS, and evidence');
      const observedAt = Date.parse(counterevidence.observedAt);
      const priorPassedAt = Date.parse(context.priorVisualPassedAt);
      const returnedAt = Date.parse(returnReceipt?.timestamp ?? '');
      if (!(observedAt > priorPassedAt)) errors.push('frontend counterevidence is stale relative to the prior visual PASS');
      if (!Number.isFinite(returnedAt) || observedAt > returnedAt) errors.push('frontend counterevidence observation cannot postdate its canonical RETURN');
      return errors;
    }
    if (operatorId === 'fe/source-apply') {
      const errors = [];
      const context = inputDocument?.context;
      const input = inputDocument?.input;
      const output = outputDocument?.output;
      if (!context || !input || !output) return ['source apply requires complete input and output documents'];
      if (output.outcome === 'backend-required') {
        return output.handoff?.resumeState === context.resumeState
          ? []
          : ['source apply backend handoff resume state differs from the exact invocation state'];
      }
      if (output.outcome !== 'applied') return [];
      const result = output.result;
      const compiled = validatedCompiles.get(input.compiledRequestRef);
      if (!compiled || compiled.missionId !== returnReceipt?.missionId) return ['source apply is not bound to a validated same-mission compiled request'];
      const compiledResult = compiled.result;
      for (const field of ['compiledRequestFingerprint','targetRef','directionMode','behaviorContractRef','behaviorContractFingerprint','proofMatrixFingerprint','sourceBoundaryFingerprint']) {
        if (input[field] !== compiledResult[field]) errors.push(`source apply ${field} differs from the registered compiled request`);
      }
      for (const field of [...GOVERNANCE_FIELDS,'proofMatrix','constraints','sourceBoundary']) {
        if (!sameValue(input[field], compiledResult[field])) errors.push(`source apply ${field} differs from the registered compiled request`);
      }
      if (input.directionMode === 'none') {
        if (input.directionBinding !== null) errors.push('refine source apply cannot carry a generated direction binding');
      } else {
        const directionRef = input.directionBinding?.directionGenerateReturnReceiptRef;
        const direction = validatedDirections.get(directionRef);
        if (!direction || direction.missionId !== returnReceipt?.missionId || direction.result.compiledRequestRef !== input.compiledRequestRef) errors.push('source apply direction is not bound to a validated same-mission generation');
        const candidate = direction?.result?.directions?.find(({ id }) => id === input.directionBinding?.selectedDirectionId);
        if (!candidate || candidate.visualPanelRef !== input.directionBinding?.selectedDirectionRef || candidate.grammarDecisionManifestRef !== input.directionBinding?.grammarDecisionManifestRef) errors.push('source apply direction binding differs from the exact generated candidate');
        if (input.directionMode === 'dominant' && (direction?.result?.requiresChoice !== false || direction?.result?.directionCount !== 1)) errors.push('dominant source apply requires the single validated non-choice direction');
        if (input.directionMode === 'alternatives') {
          const selection = directionSelections.get(directionRef);
          if (!selection || selection.selectedDirectionId !== input.directionBinding?.selectedDirectionId) errors.push('alternatives source apply requires the exact registry-validated user selection');
        }
      }
      for (const field of ['mode','compiledRequestRef','compiledRequestFingerprint','directionMode','directionBinding',...GOVERNANCE_FIELDS,'proofMatrix','proofMatrixFingerprint','targetRef','behaviorContractRef','behaviorContractFingerprint','sourceBoundary','sourceBoundaryFingerprint']) {
        if (!sameValue(result?.[field], input[field])) errors.push(`source apply result ${field} differs from invocation input`);
      }
      return errors;
    }
    if (operatorId === 'fe/capture-preflight') {
      const errors = [];
      const input = inputDocument?.input;
      const context = inputDocument?.context;
      const output = outputDocument?.output;
      const result = outputDocument?.output?.result;
      if (!input || !context || !output) return ['capture preflight requires complete input and output documents'];
      const compiled = validatedCompiles.get(input.compiledRequestRef);
      const sourceApply = validatedSourceApplications.get(input.sourceApplyReturnReceiptRef);
      if (!compiled || compiled.missionId !== returnReceipt?.missionId) errors.push('capture preflight is not bound to a validated same-mission compiled request');
      if (!sourceApply || sourceApply.missionId !== returnReceipt?.missionId || sourceApply.compiledRequestRef !== input.compiledRequestRef) errors.push('capture preflight is not bound to the exact validated source-apply RETURN');
      if (compiled && input.compiledRequestFingerprint !== compiled.result.compiledRequestFingerprint) errors.push('capture preflight compiled fingerprint differs from registered request');
      if (sourceApply && input.aggregateAfterFingerprint !== sourceApply.aggregateAfterFingerprint) errors.push('capture preflight source fingerprint differs from the registered applied mutation');
      if (compiled) {
        const expectedMatrix = { ...compiled.result.proofMatrix, matrixFingerprint: compiled.result.proofMatrixFingerprint };
        if (!sameValue(input.matrix, expectedMatrix)) errors.push('capture preflight matrix differs from the author-once compiled proof matrix');
      }
      if (output.outcome === 'backend-required') {
        if (errors.length > 0) return errors;
        return output.handoff?.resumeState === context.resumeState
          ? []
          : ['capture preflight backend handoff resume state differs from the exact invocation state'];
      }
      if (output.outcome !== 'ready') return [];
      if (!result) return ['ready capture preflight requires a complete result'];
      for (const field of ['compiledRequestRef','compiledRequestFingerprint','sourceApplyReturnReceiptRef','aggregateAfterFingerprint']) {
        if (result[field] !== input[field]) errors.push(`capture preflight result ${field} differs from invocation input`);
      }
      if (result.matrixRef !== input.matrix.matrixRef || result.matrixFingerprint !== input.matrix.matrixFingerprint) errors.push('capture preflight matrix differs from invocation input');
      if (result.partitionFingerprint !== contentFingerprint(input.partitions)) errors.push('capture preflight partition fingerprint must hash the exact owner partition map');
      if (JSON.stringify(result.round) !== JSON.stringify(input.round)) errors.push('capture preflight round differs from invocation input');
      const captureRefs = input.partitions.filter(({ disposition }) => disposition !== 'reuse').map(({ partitionRef }) => partitionRef);
      const reusedRefs = input.partitions.filter(({ disposition }) => disposition === 'reuse').map(({ partitionRef }) => partitionRef);
      if (!sameSequence(result.capturePartitionRefs, captureRefs) || !sameSequence(result.reusedPartitionRefs, reusedRefs)) errors.push('capture preflight partition disposition differs from invocation input');
      if (JSON.stringify(result.readinessChecks) !== JSON.stringify(input.readinessChecks)) errors.push('capture preflight readiness evidence differs from invocation input');
      for (const field of GOVERNANCE_FIELDS) {
        if (!sameValue(result[field], input[field])) errors.push(`capture preflight ${field} differs from invocation input`);
      }
      return errors;
    }
    if (operatorId === 'quality/delivery-proof' && outputDocument?.output?.outcome === 'pass') {
      const supplied = new Set([...(inputDocument?.context?.contextRefs ?? []), ...(inputDocument?.context?.sourceRefs ?? [])]);
      const resultRef = outputDocument.output.resultRef;
      const allowed = new Set([...supplied, resultRef]);
      return outputDocument.output.evidenceRefs.some((ref) => !allowed.has(ref))
        ? ['quality PASS evidence is not bound to supplied context/source evidence or the concrete result']
        : [];
    }
    if (operatorId === 'fe/render-capture') {
      const errors = [];
      const input = inputDocument?.input;
      const context = inputDocument?.context;
      const result = outputDocument?.output?.result;
      if (!input || !context || !result) return ['render capture requires complete input and output documents'];
      if (result.sourceFingerprint !== input.preflight.aggregateAfterFingerprint || result.aggregateAfterFingerprint !== input.preflight.aggregateAfterFingerprint) errors.push('render capture source differs from the registered applied mutation');
      const preflight = input.preflight;
      const frozenPreflight = validatedPreflights.get(preflight.preflightRef);
      if (!frozenPreflight) errors.push('render capture preflight is not bound to a validated capture-preflight RETURN');
      if (frozenPreflight) {
        const supplied = { receiptId: frozenPreflight.receiptId, ...preflight };
        const frozenCore = Object.fromEntries(Object.entries(frozenPreflight).filter(([field]) => !GOVERNANCE_FIELDS.includes(field)));
        if (!sameValue(supplied, frozenCore)) errors.push('render capture preflight differs from the exact validated freeze');
        for (const field of GOVERNANCE_FIELDS) {
          if (!sameValue(input[field], frozenPreflight[field])) errors.push(`render capture ${field} differs from the exact validated preflight`);
        }
      }
      if (result.preflightRef !== preflight.preflightRef) errors.push('render capture preflight differs from invocation input');
      for (const field of ['compiledRequestRef','compiledRequestFingerprint','sourceApplyReturnReceiptRef','aggregateAfterFingerprint']) {
        if (result[field] !== preflight[field]) errors.push(`render capture ${field} differs from frozen preflight`);
      }
      if (result.matrixRef !== preflight.matrixRef || result.matrixFingerprint !== preflight.matrixFingerprint) errors.push('render capture matrix fingerprint differs from frozen preflight');
      if (result.partitionFingerprint !== preflight.partitionFingerprint) errors.push('render capture partition fingerprint differs from frozen preflight');
      if (JSON.stringify(result.visualRound) !== JSON.stringify(preflight.round)) errors.push('render capture visual round differs from frozen preflight');
      if (!sameSequence(result.capturePartitionRefs, preflight.capturePartitionRefs) || !sameSequence(result.reusedPartitionRefs, preflight.reusedPartitionRefs)) errors.push('render capture owner partitions differ from frozen preflight');
      for (const field of GOVERNANCE_FIELDS) {
        if (!sameValue(result[field], input[field])) errors.push(`render capture ${field} differs from invocation input`);
      }
      if (!sameValue(result.blindReviewPacket?.grammarBinding, blindGrammarBinding(input.grammarBinding))) errors.push('render capture blind Grammar binding differs from the opaque invocation projection');
      if (!sameValue(result.blindReviewPacket?.iconographyManifest, blindIconographyManifest(input.iconographyManifest))) errors.push('render capture blind iconography manifest differs from the opaque invocation projection');
      if (!sameValue(result.blindReviewPacket?.mediaManifest, blindMediaManifest(input.mediaManifest))) errors.push('render capture blind media manifest differs from the opaque invocation projection');
      if (!sameValue(result.blindReviewPacket?.productFamilyEvidence, input.productFamilyEvidence)) errors.push('render capture blind product-family evidence differs from invocation input');
      const expectedCells = input.renderStates.flatMap((stateRef) => input.viewports.map((viewport) => `${stateRef}::${viewport}`));
      const actualCells = result.renderMatrix.map(({ stateRef, viewport }) => `${stateRef}::${viewport}`);
      if (!sameSequence(actualCells, expectedCells)) errors.push('render capture matrix differs from requested state and viewport order');
      const exactCaptureRasterRefs = [
        result.handoffHostArtifact.imageRef,
        ...result.renderMatrix.map(({ imageRef }) => imageRef),
        ...result.adversarialProbeMatrix.filter(({ outcome }) => outcome !== 'not-applicable').map(({ imageRef }) => imageRef),
      ];
      const packetRasterRefs = result.blindReviewPacket?.rasterCells?.map(({ imageRef }) => imageRef) ?? [];
      if (!sameSequence(packetRasterRefs, exactCaptureRasterRefs)) errors.push('render capture packet rasters differ from exact captured raster sequence');
      if (result.renderMatrix.some(({ stateRef, handoffState }) => handoffState !== (stateRef === input.handoffStateRef))) errors.push('render capture handoff state differs from invocation input');
      const host = result.handoffHostArtifact;
      const requestedHost = input.handoffViewport;
      if (host.surfaceRef !== requestedHost.surfaceRef || host.widthPx !== requestedHost.widthPx || host.heightPx !== requestedHost.heightPx || host.viewportOverride !== requestedHost.viewportOverride) errors.push('render capture handoff viewport differs from invocation input');
      const actualProbes = result.adversarialProbeMatrix ?? [];
      if (actualProbes.length !== input.adversarialProbes.length) errors.push('render capture probe matrix differs from invocation input');
      input.adversarialProbes.forEach((expected, index) => {
        const actual = actualProbes[index];
        for (const field of ['probeId','category','phase','stateRef','attempt','expectedFailure']) {
          if (!actual || actual[field] !== expected[field]) errors.push(`render capture probe at index ${index} ${field} differs from invocation input order`);
        }
      });
      return errors;
    }
    if (operatorId !== 'fe/visual-fidelity') return [];
    const errors = [];
    const context = inputDocument?.context;
    const packet = inputDocument?.input?.blindReviewPacket;
    const result = outputDocument?.output?.result;
    if (!context || !packet || !result) return ['visual fidelity requires complete input and output documents'];

    const capture = validatedCapturePackets.get(packet.packetRef);
    if (!capture) errors.push('blind review packet is not bound to a validated render-capture RETURN');
    if (capture) {
      if (packet.captureReceiptId !== capture.receiptId) errors.push('capture receipt differs from the validated render-capture RETURN');
      if (packet.packetFingerprint !== capture.packetFingerprint) errors.push('packet fingerprint differs from validated render-capture evidence');
      if (packet.capturedSourceFingerprint !== capture.sourceFingerprint) errors.push('captured source differs from validated render-capture evidence');
      if (!sameValue(manifestFromVisualPacket(packet), capture.manifest)) errors.push('blind packet differs from the exact validated render-capture manifest');
    }

    const suppliedRasters = [...new Set([
      ...(packet.rasterCells ?? []).map(({ imageRef }) => imageRef),
      ...(packet.probeCells ?? []).filter(({ applicable }) => applicable).map(({ imageRef }) => imageRef),
    ])];
    if (result.packetFingerprint !== packet.packetFingerprint) errors.push('packet fingerprint differs from supplied input');
    if (result.matrixFingerprint !== packet.matrixFingerprint) errors.push('matrix fingerprint differs from supplied input');
    if (result.partitionFingerprint !== packet.partitionFingerprint) errors.push('partition fingerprint differs from supplied input');
    if (JSON.stringify(result.visualRound) !== JSON.stringify(packet.visualRound)) errors.push('visual round differs from supplied input');
    if (result.auditScore?.target !== inputDocument.input.auditTargetScore) errors.push('audit score target differs from supplied mission target');
    if (!sameSequence(result.packetRasterRefs ?? [], suppliedRasters)) errors.push('packet raster refs differ from supplied input order');
    if (result.lastScreenshotRef !== packet.lastScreenshotRef) errors.push('last screenshot differs from supplied input');
    for (const field of GOVERNANCE_FIELDS) {
      if (!sameValue(result[field], packet[field])) errors.push(`visual fidelity ${field} differs from supplied packet`);
    }
    if (result.reviewerExecutionRef !== context.reviewerExecutionRef) errors.push('reviewer execution differs from supplied context');
    if (result.reviewerModel !== context.reviewerModel || result.reviewerCount !== context.reviewerCount || result.contextIsolation !== context.contextIsolation || result.forkTurns !== context.forkTurns) errors.push('review execution policy differs from supplied context');
    if (returnReceipt && (returnReceipt.trace?.aiActivity?.executionRef !== context.reviewerExecutionRef || returnReceipt.trace?.aiActivity?.principalFingerprint !== context.reviewerPrincipalFingerprint || returnReceipt.trace?.aiActivity?.contextFingerprint !== context.reviewerContextFingerprint)) errors.push('reviewer execution, principal, or fresh context differs from the runtime receipt');
    const packetProbes = packet.probeCells ?? [];
    const outputProbes = result.probeRecords ?? [];
    packetProbes.forEach((probe, index) => {
      const probeRecord = outputProbes[index];
      if (!probeRecord || probeRecord.probeId !== probe.probeId || probeRecord.category !== probe.category || probeRecord.phase !== probe.phase || probeRecord.imageRef !== probe.imageRef || (probe.applicable ? probeRecord.verdict === 'not-applicable' : probeRecord.verdict !== 'not-applicable')) errors.push(`output probe at index ${index} differs from the supplied blind packet order`);
    });
    if (outputProbes.length !== packetProbes.length) errors.push('output probe records must bind one-to-one to the supplied blind packet');
    if (outputDocument?.output?.outcome === 'passed') {
      if (result.inspectionRecords?.some(({ verdict, lensVerdicts = [], challengeRecords = [] }) => verdict !== 'passed' || lensVerdicts.some(({ verdict: lensVerdict }) => lensVerdict === 'problem') || challengeRecords.some(({ disposition }) => disposition === 'confirmed'))) errors.push('visual problem or confirmed challenge forbids aggregate passed');
      if (result.probeRecords?.some(({ verdict }) => verdict === 'contradiction')) errors.push('probe contradiction forbids aggregate passed');
      if (result.lastScreenshotVerdict !== 'passed') errors.push('non-passing final screenshot forbids aggregate passed');
      if (result.uncertainty !== false) errors.push('reviewer uncertainty forbids aggregate passed');
    }
    return errors;
  }

  return Object.freeze({ record, recordDirectionSelection, validate });
}
