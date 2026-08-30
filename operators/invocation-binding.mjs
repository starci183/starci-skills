function sameSequence(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function manifestFromVisualPacket(packet) {
  return {
    packetRef: packet.packetRef,
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
  const validatedCapturePackets = new Map();

  function record(operatorId, outputDocument, returnReceipt) {
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

  function validate(operatorId, inputDocument, outputDocument, returnReceipt = null) {
    if (operatorId === 'quality/delivery-proof' && outputDocument?.output?.outcome === 'pass') {
      const supplied = new Set([...(inputDocument?.context?.contextRefs ?? []), ...(inputDocument?.context?.sourceRefs ?? [])]);
      const resultRef = outputDocument.output.resultRef;
      const allowed = new Set([...supplied, resultRef]);
      return outputDocument.output.evidenceRefs.some((ref) => !allowed.has(ref))
        ? ['quality PASS evidence is not bound to supplied context/source evidence or the concrete result']
        : [];
    }
    if (operatorId === 'fe/independent-review') {
      const errors = [];
      const input = inputDocument?.input;
      const result = outputDocument?.output?.result;
      if (!input || !result) return ['independent review requires complete input and output documents'];
      if (!sameSequence(result.inspectionRefs ?? [], input.rasterRefs ?? [])) errors.push('independent review raster refs differ from supplied order');
      const verdictRefs = result.inspectionVerdicts?.map(({ inspectionRef }) => inspectionRef) ?? [];
      if (!sameSequence(verdictRefs, input.rasterRefs ?? [])) errors.push('independent review raster verdicts are not one-to-one with supplied rasters');
      const expectedProbes = input.probeSequence ?? [];
      const actualProbes = result.probeVerdicts ?? [];
      if (expectedProbes.length !== actualProbes.length) errors.push('independent review probe verdict count differs from supplied probes');
      expectedProbes.forEach((expected,index)=>{
        const actual=actualProbes[index];
        if(!actual||actual.probeId!==expected.probeId||actual.category!==expected.category||actual.phase!==expected.phase) errors.push(`independent review probe at index ${index} differs from supplied order`);
      });
      return errors;
    }
    if (operatorId === 'fe/render-capture') {
      const errors = [];
      const input = inputDocument?.input;
      const context = inputDocument?.context;
      const result = outputDocument?.output?.result;
      if (!input || !context || !result) return ['render capture requires complete input and output documents'];
      if (result.sourceFingerprint !== context.sourceFingerprint) errors.push('render capture source differs from invocation input');
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
      if (JSON.stringify(manifestFromVisualPacket(packet)) !== JSON.stringify(capture.manifest)) errors.push('blind packet differs from the exact validated render-capture manifest');
    }

    const suppliedRasters = [...new Set([
      ...(packet.rasterCells ?? []).map(({ imageRef }) => imageRef),
      ...(packet.probeCells ?? []).filter(({ applicable }) => applicable).map(({ imageRef }) => imageRef),
    ])];
    if (result.packetFingerprint !== packet.packetFingerprint) errors.push('packet fingerprint differs from supplied input');
    if (!sameSequence(result.packetRasterRefs ?? [], suppliedRasters)) errors.push('packet raster refs differ from supplied input order');
    if (result.lastScreenshotRef !== packet.lastScreenshotRef) errors.push('last screenshot differs from supplied input');
    if (result.reviewerExecutionRef !== context.reviewerExecutionRef) errors.push('reviewer execution differs from supplied context');
    if (result.reviewerModel !== context.reviewerModel || result.reviewerCount !== context.reviewerCount || result.contextIsolation !== context.contextIsolation || result.forkTurns !== context.forkTurns) errors.push('review execution policy differs from supplied context');
    if (returnReceipt && (returnReceipt.trace?.aiActivity?.principalFingerprint !== context.reviewerPrincipalFingerprint || returnReceipt.trace?.aiActivity?.contextFingerprint !== context.reviewerContextFingerprint)) errors.push('reviewer principal or fresh context differs from the runtime receipt');
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

  return Object.freeze({ record, validate });
}
