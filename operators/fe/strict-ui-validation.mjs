import crypto from 'node:crypto';

const fingerprint = (value) => `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;

export const REQUIRED_VIEWPORTS = ['wide', 'intermediate', 'compact'];
export const REQUIRED_PROBE_CATEGORIES = [
  'viewport',
  'zoom',
  'page-scroll',
  'bounded-scroll',
  'content-stress',
  'state-transition',
  'sticky-fixed-overlay',
  'drag',
  'keyboard-focus',
  'composition-neighbors',
];
export const REQUIRED_VISUAL_LENSES = [
  'page-inset',
  'surface-opacity',
  'content-padding',
  'alignment',
  'vertical-rhythm',
  'hierarchy',
  'visual-ownership',
  'pinned-boundary-clearance',
  'wrapping',
  'clipping',
  'occlusion',
  'semantic-utility',
  'content-coherence',
  'affordance',
  'responsive-composition',
  'visual-consistency',
  'empty-space-balance',
  'task-scanability',
];
export const REQUIRED_CHALLENGE_FAMILIES = [
  'purpose-content',
  'composition-spacing',
  'interaction-responsive',
];
export const REQUIRED_PROBE_COUNTS = {
  zoom: 3,
  'page-scroll': 4,
  'bounded-scroll': 3,
  'state-transition': 3,
};
export const REQUIRED_PROBE_PHASES = {
  viewport: ['baseline', 'breakpoint-edge'],
  zoom: ['zoom-in', 'zoom-out', 'restored'],
  'page-scroll': ['start', 'middle', 'end', 'restored'],
  'bounded-scroll': ['start', 'end', 'restored'],
  'content-stress': ['content-long', 'content-short'],
  'state-transition': ['skeleton', 'loading', 'steady'],
  'sticky-fixed-overlay': ['baseline', 'overlay-open'],
  drag: ['drag-limit'],
  'keyboard-focus': ['focus'],
  'composition-neighbors': ['baseline'],
};
export const REQUIRED_PREFLIGHT_CHECKS = [
  'data-ready',
  'steady-not-skeleton',
  'state-content-valid',
  'controls-effective',
  'page-scroll-restored',
  'bounded-scroll-restored',
  'zoom-restored',
  'probe-complete',
  'raster-unique',
  'handoff-host-valid',
];
export const VISUAL_ROUND_PURPOSES = Object.freeze({ 1: 'discovery', 2: 'verification' });
const visualRoundPurpose = (number) => number === 1 ? 'discovery' : number === 2 ? 'verification' : 'regression';

const duplicates = (values) => values.filter((value, index) => values.indexOf(value) !== index);
const missing = (required, actual) => required.filter((value) => !actual.includes(value));
const rasterRefPattern = /sha256[-/][0-9a-f]{64}\.(?:png|jpe?g|webp)$/;
const exactSequence = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);
export const isContentAddressedRasterRef = (value) => typeof value === 'string' && rasterRefPattern.test(value);

export function runtimeObserveSemantic(value) {
  const errors = [];
  const { outcome, result, gaps, evidenceRefs } = value.output;
  if (outcome === 'observed') {
    if (!result) errors.push('$.output.result: observed requires a structured result');
    if (gaps.length > 0) errors.push('$.output.gaps: observed cannot retain unresolved gaps');
    if (evidenceRefs.length === 0) errors.push('$.output.evidenceRefs: observed requires direct runtime evidence');
    const viewports = result?.responsiveStateInventory?.map(({ viewport }) => viewport) ?? [];
    for (const viewport of missing(REQUIRED_VIEWPORTS, viewports)) {
      errors.push(`$.output.result.responsiveStateInventory: missing ${viewport}`);
    }
    if (duplicates(viewports).length > 0) {
      errors.push('$.output.result.responsiveStateInventory: duplicate viewport observations are forbidden');
    }
    const interactionRefs = result?.interactionInventory?.map(({ interactionRef }) => interactionRef) ?? [];
    if (duplicates(interactionRefs).length > 0) {
      errors.push('$.output.result.interactionInventory: duplicate interactionRef values are forbidden');
    }
  }
  if (outcome !== 'observed' && result !== null) {
    errors.push('$.output.result: incomplete observation outcomes must return null');
  }
  return errors;
}

export function auditOutputSemantic(value) {
  const errors = [];
  const { outcome, result, gaps, evidenceRefs } = value.output;
  if (outcome === 'passed') {
    if (!result) errors.push('$.output.result: passed requires structured checks');
    if (gaps.length > 0) errors.push('$.output.gaps: passed cannot retain gaps');
    if (evidenceRefs.length === 0) errors.push('$.output.evidenceRefs: passed requires evidence');
    if (result?.checks?.some(({ verdict }) => verdict !== 'passed')) {
      errors.push('$.output.result.checks: every check must pass before aggregate passed');
    }
  }
  if (outcome === 'findings' && !result?.checks?.some(({ verdict }) => verdict === 'finding')) {
    errors.push('$.output.result.checks: findings requires at least one finding verdict');
  }
  if (outcome === 'authority-gap' && !result?.checks?.some(({ verdict }) => verdict === 'authority-gap')) {
    errors.push('$.output.result.checks: authority-gap requires at least one authority-gap verdict');
  }
  const checkRefs = result?.checks?.map(({ checkRef }) => checkRef) ?? [];
  if (duplicates(checkRefs).length > 0) errors.push('$.output.result.checks: duplicate checkRef values are forbidden');
  return errors;
}

export function preservationContractSemantic(contract, at = '$.input.preservationContract') {
  const errors = [];
  if (!contract) return [`${at}: required`];
  const observed = contract.observedInteractionRefs ?? [];
  const decisions = contract.interactionDecisions ?? [];
  const decided = decisions.map(({ interactionRef }) => interactionRef);
  for (const ref of missing(observed, decided)) errors.push(`${at}.interactionDecisions: missing decision for ${ref}`);
  for (const ref of decided.filter((ref) => !observed.includes(ref))) {
    errors.push(`${at}.interactionDecisions: ${ref} was not observed`);
  }
  if (duplicates(decided).length > 0) errors.push(`${at}.interactionDecisions: duplicate interaction decisions are forbidden`);
  decisions.forEach((decision, index) => {
    if (decision.decision === 'remove' || decision.decision === 'replace') {
      if (!decision.authorityRef) errors.push(`${at}.interactionDecisions[${index}].authorityRef: required for ${decision.decision}`);
      if (!decision.rationale) errors.push(`${at}.interactionDecisions[${index}].rationale: required for ${decision.decision}`);
    }
    if (decision.decision === 'replace' && !decision.replacementRef) {
      errors.push(`${at}.interactionDecisions[${index}].replacementRef: required for replace`);
    }
  });
  const viewports = contract.responsiveStates?.map(({ viewport }) => viewport) ?? [];
  for (const viewport of missing(REQUIRED_VIEWPORTS, viewports)) errors.push(`${at}.responsiveStates: missing ${viewport}`);
  if (duplicates(viewports).length > 0) errors.push(`${at}.responsiveStates: duplicate viewports are forbidden`);
  return errors;
}

export function probeCoverageSemantic(probes, at) {
  const errors = [];
  const categories = probes?.map(({ category }) => category) ?? [];
  const probeIds = probes?.map(({ probeId }) => probeId) ?? [];
  for (const category of missing(REQUIRED_PROBE_CATEGORIES, categories)) errors.push(`${at}: missing ${category}`);
  for (const [category, minimum] of Object.entries(REQUIRED_PROBE_COUNTS)) {
    const count = categories.filter((value) => value === category).length;
    if (count < minimum) errors.push(`${at}: ${category} requires at least ${minimum} lifecycle phases`);
  }
  for (const [category, requiredPhases] of Object.entries(REQUIRED_PROBE_PHASES)) {
    const actualPhases = (probes ?? []).filter((probe) => probe.category === category).map(({ phase }) => phase);
    for (const phase of missing(requiredPhases, actualPhases)) errors.push(`${at}: ${category} missing ${phase}`);
    if (actualPhases.length !== requiredPhases.length || duplicates(actualPhases).length > 0) errors.push(`${at}: ${category} phases must be exactly ${requiredPhases.join(', ')}`);
  }
  const expectedSequence = REQUIRED_PROBE_CATEGORIES.flatMap((category) => REQUIRED_PROBE_PHASES[category].map((phase) => `${category}:${phase}`));
  const actualSequence = (probes ?? []).map(({ category, phase }) => `${category}:${phase}`);
  if (!exactSequence(actualSequence, expectedSequence)) errors.push(`${at}: probe lifecycle must follow canonical category and phase order`);
  if (duplicates(probeIds).length > 0) errors.push(`${at}: duplicate probeId values are forbidden`);
  return errors;
}

export function renderMatrixSemantic(matrix, at) {
  const errors = [];
  const cellIds = matrix?.map(({ stateRef, viewport }) => `${stateRef}::${viewport}`) ?? [];
  if (duplicates(cellIds).length > 0) errors.push(`${at}: duplicate state/viewport cells are forbidden`);
  const states = [...new Set(matrix?.map(({ stateRef }) => stateRef) ?? [])];
  for (const stateRef of states) {
    const viewports = matrix.filter((cell) => cell.stateRef === stateRef).map(({ viewport }) => viewport);
    for (const viewport of missing(REQUIRED_VIEWPORTS, viewports)) errors.push(`${at}: ${stateRef} missing ${viewport}`);
    if (!exactSequence(viewports, REQUIRED_VIEWPORTS)) errors.push(`${at}: ${stateRef} viewports must be ordered ${REQUIRED_VIEWPORTS.join(', ')}`);
  }
  return errors;
}

export function capturePreflightInputSemantic(value) {
  const errors = [];
  const { round, matrix, partitions, readinessChecks } = value.input;
  if (visualRoundPurpose(round.number) !== round.purpose) {
    errors.push(`$.input.round.purpose: round ${round.number} must be ${visualRoundPurpose(round.number)}`);
  }
  if (!exactSequence(matrix.viewports, REQUIRED_VIEWPORTS)) {
    errors.push(`$.input.matrix.viewports: must be ordered ${REQUIRED_VIEWPORTS.join(', ')}`);
  }
  const expectedMatrixFingerprint = fingerprint({ renderStates: matrix.renderStates, viewports: matrix.viewports, probeRefs: matrix.probeRefs });
  if (matrix.matrixFingerprint !== expectedMatrixFingerprint) errors.push('$.input.matrix.matrixFingerprint: must hash the exact immutable matrix body');
  const checks = readinessChecks.map(({ check }) => check);
  if (!exactSequence(checks, REQUIRED_PREFLIGHT_CHECKS)) {
    errors.push(`$.input.readinessChecks: must be ordered ${REQUIRED_PREFLIGHT_CHECKS.join(', ')}`);
  }
  if (duplicates(checks).length > 0) errors.push('$.input.readinessChecks: duplicate checks are forbidden');
  const partitionRefs = partitions.map(({ partitionRef }) => partitionRef);
  if (duplicates(partitionRefs).length > 0) errors.push('$.input.partitions: duplicate partitionRef values are forbidden');
  for (const [index, partition] of partitions.entries()) {
    if (partition.disposition === 'reuse' && partition.dependencyProofRefs.length === 0) {
      errors.push(`$.input.partitions[${index}].dependencyProofRefs: reuse requires exact dependency proof`);
    }
    if (partition.disposition === 'shared-sentinel' && partition.dependencyProofRefs.length > 0) {
      errors.push(`$.input.partitions[${index}]: shared sentinels are recaptured, never justified as reusable`);
    }
    for (const stateRef of partition.stateRefs) {
      if (!matrix.renderStates.includes(stateRef)) errors.push(`$.input.partitions[${index}].stateRefs: ${stateRef} is absent from the frozen matrix`);
    }
    for (const probeRef of partition.probeRefs) {
      if (!matrix.probeRefs.includes(probeRef)) errors.push(`$.input.partitions[${index}].probeRefs: ${probeRef} is absent from the frozen matrix`);
    }
  }
  for (const stateRef of matrix.renderStates) {
    if (!partitions.some((partition) => partition.stateRefs.includes(stateRef))) errors.push(`$.input.partitions: frozen state ${stateRef} has no owner partition`);
  }
  for (const probeRef of matrix.probeRefs) {
    if (!partitions.some((partition) => partition.probeRefs.includes(probeRef))) errors.push(`$.input.partitions: frozen probe ${probeRef} has no owner partition`);
  }
  return errors;
}

export function capturePreflightOutputSemantic(value) {
  const errors = [];
  const { outcome, result, gaps, evidenceRefs } = value.output;
  if (outcome === 'ready') {
    if (!result) return ['$.output.result: ready requires a frozen preflight result'];
    if (/\b\d+(?:\.\d+)?\s*(?:\/|out\s+of\s+)\s*10\b/i.test(result.summary)) {
      errors.push('$.output.result.summary: capture readiness must not be expressed as a ten-point score');
    }
    if (gaps.length > 0) errors.push('$.output.gaps: ready cannot retain gaps');
    if (evidenceRefs.length === 0) errors.push('$.output.evidenceRefs: ready requires deterministic evidence');
    if (visualRoundPurpose(result.round?.number) !== result.round?.purpose) errors.push('$.output.result.round: number and purpose do not match the visual-round policy');
    const checks = result.readinessChecks ?? [];
    if (!exactSequence(checks.map(({ check }) => check), REQUIRED_PREFLIGHT_CHECKS)) errors.push('$.output.result.readinessChecks: exact ordered readiness matrix is required');
    if (checks.some(({ verdict }) => verdict !== 'passed')) errors.push('$.output.result.readinessChecks: every deterministic check must pass before capture');
    if ((result.capturePartitionRefs?.length ?? 0) === 0) errors.push('$.output.result.capturePartitionRefs: at least one owner partition must be captured');
  } else if (result !== null) {
    errors.push('$.output.result: incomplete preflight outcomes must return null');
  }
  if (outcome !== 'ready' && gaps.length === 0) errors.push('$.output.gaps: non-ready preflight requires exact gaps');
  return errors;
}

export function renderCaptureInputSemantic(value) {
  const errors = probeCoverageSemantic(value.input.adversarialProbes, '$.input.adversarialProbes');
  if (!exactSequence(value.input.viewports, REQUIRED_VIEWPORTS)) errors.push(`$.input.viewports: must be ordered ${REQUIRED_VIEWPORTS.join(', ')}`);
  const { preflight } = value.input;
  if (!preflight) errors.push('$.input.preflight: validated capture preflight is required');
  if (preflight && visualRoundPurpose(preflight.round.number) !== preflight.round.purpose) errors.push('$.input.preflight.round: number and purpose do not match');
  return errors;
}

export function renderCaptureOutputSemantic(value) {
  const errors = [];
  if (value.output.outcome === 'captured') {
    const result = value.output.result;
    if (!result) return ['$.output.result: captured requires structured evidence'];
    if (result.preflightRef == null) errors.push('$.output.result.preflightRef: capture must bind a validated preflight');
    if (visualRoundPurpose(result.visualRound?.number) !== result.visualRound?.purpose) errors.push('$.output.result.visualRound: number and purpose do not match');
    errors.push(...renderMatrixSemantic(result.renderMatrix, '$.output.result.renderMatrix'));
    errors.push(...probeCoverageSemantic(result.adversarialProbeMatrix, '$.output.result.adversarialProbeMatrix'));
    if (!result.renderMatrix.some(({ handoffState }) => handoffState)) {
      errors.push('$.output.result.renderMatrix: handoff state cell is required');
    }
    if (result.sourceFingerprint !== result.latestMutationFingerprint) {
      errors.push('$.output.result: render source must equal the latest mutation fingerprint');
    }
    if (Date.parse(result.capturedAt) < Date.parse(result.latestMutationAt)) {
      errors.push('$.output.result.capturedAt: capture must occur after the latest mutation');
    }
    if (!result.artifactRefs.includes(result.blindReviewPacketRef)) {
      errors.push('$.output.result.blindReviewPacketRef: frozen packet must be retained as an artifact');
    }
    if (result.blindReviewPacket?.packetRef !== result.blindReviewPacketRef) errors.push('$.output.result.blindReviewPacket: packetRef differs from retained packet');
    for (const field of ['preflightRef', 'matrixRef', 'matrixFingerprint', 'partitionFingerprint']) {
      if (result.blindReviewPacket?.[field] !== result[field]) errors.push(`$.output.result.blindReviewPacket.${field}: differs from capture result`);
    }
    if (JSON.stringify(result.blindReviewPacket?.visualRound) !== JSON.stringify(result.visualRound)) errors.push('$.output.result.blindReviewPacket.visualRound: differs from capture result');
    if (!exactSequence(result.blindReviewPacket?.capturePartitionRefs ?? [], result.capturePartitionRefs ?? [])) errors.push('$.output.result.blindReviewPacket.capturePartitionRefs: differs from capture result');
    if (!exactSequence(result.blindReviewPacket?.reusedPartitionRefs ?? [], result.reusedPartitionRefs ?? [])) errors.push('$.output.result.blindReviewPacket.reusedPartitionRefs: differs from capture result');
    if (fingerprint(result.blindReviewPacket) !== result.blindReviewPacketFingerprint) errors.push('$.output.result.blindReviewPacketFingerprint: must hash the exact complete packet manifest');
    if (result.blindReviewPacket?.capturedSourceFingerprint !== result.sourceFingerprint || result.blindReviewPacket?.latestMutationFingerprint !== result.latestMutationFingerprint) errors.push('$.output.result.blindReviewPacket: source fingerprints differ from capture result');
    if (result.blindReviewPacket?.capturedAt !== result.capturedAt || result.blindReviewPacket?.latestMutationAt !== result.latestMutationAt) errors.push('$.output.result.blindReviewPacket: capture timestamps differ from capture result');
    const matrixRasterRefs = result.renderMatrix.map(({ imageRef }) => imageRef);
    const probeRasterRefs = result.adversarialProbeMatrix.filter(({ outcome }) => outcome !== 'not-applicable').map(({ imageRef }) => imageRef);
    const exactCapturedRasterRefs = [result.handoffHostArtifact.imageRef, ...matrixRasterRefs, ...probeRasterRefs];
    const packetRasterRefs = result.blindReviewPacket?.rasterCells?.map(({ imageRef }) => imageRef) ?? [];
    if (!exactSequence(packetRasterRefs, exactCapturedRasterRefs)) errors.push('$.output.result.blindReviewPacket.rasterCells: must exactly equal host + render matrix + applicable probe rasters in capture order');
    for (const imageRef of exactCapturedRasterRefs) if (!isContentAddressedRasterRef(imageRef)) errors.push(`$.output.result: raster ${imageRef} is not content-addressed`);
    const hostCells = result.blindReviewPacket?.rasterCells?.filter(({ viewKind }) => viewKind === 'host-context') ?? [];
    const lastCells = result.blindReviewPacket?.rasterCells?.filter(({ lastScreenshot }) => lastScreenshot) ?? [];
    if (hostCells.length !== 1 || hostCells[0].imageRef !== result.handoffHostArtifact.imageRef) errors.push('$.output.result.blindReviewPacket: host-context must equal handoff host artifact');
    if (lastCells.length !== 1 || lastCells[0].imageRef !== result.handoffHostArtifact.imageRef || result.blindReviewPacket?.lastScreenshotRef !== result.handoffHostArtifact.imageRef) errors.push('$.output.result.blindReviewPacket: final screenshot must be the uncropped handoff host artifact');
  }
  return errors;
}

export function visualFidelityInputSemantic(value) {
  const errors = [];
  const { context, input } = value;
  const packet = input.blindReviewPacket;
  if (visualRoundPurpose(packet.visualRound?.number) !== packet.visualRound?.purpose) {
    errors.push('$.input.blindReviewPacket.visualRound: number and purpose do not match');
  }
  if (context.implementerExecutionRef === context.reviewerExecutionRef) {
    errors.push('$.context.reviewerExecutionRef: blind reviewer must differ from the implementer');
  }
  if (context.implementerPrincipalFingerprint === context.reviewerPrincipalFingerprint) {
    errors.push('$.context.reviewerPrincipalFingerprint: blind reviewer principal must differ from the implementer principal');
  }
  if (context.reviewerContextFingerprint !== fingerprint(packet)) {
    errors.push('$.context.reviewerContextFingerprint: must bind the exact raster-only packet');
  }
  if (packet.capturedSourceFingerprint !== packet.latestMutationFingerprint) {
    errors.push('$.input.blindReviewPacket: capture is stale relative to the latest mutation');
  }
  if (Date.parse(packet.capturedAt) < Date.parse(packet.latestMutationAt)) {
    errors.push('$.input.blindReviewPacket.capturedAt: capture must occur after the latest mutation');
  }
  const lastCells = packet.rasterCells.filter(({ lastScreenshot }) => lastScreenshot);
  if (lastCells.length !== 1 || lastCells[0]?.imageRef !== packet.lastScreenshotRef) {
    errors.push('$.input.blindReviewPacket.lastScreenshotRef: must identify the one final post-mutation raster');
  }
  const cellRefs = packet.rasterCells.map(({ cellRef }) => cellRef);
  const imageRefs = packet.rasterCells.map(({ imageRef }) => imageRef);
  for (const imageRef of imageRefs) if (!isContentAddressedRasterRef(imageRef)) errors.push(`$.input.blindReviewPacket.rasterCells: raster ${imageRef} is not content-addressed`);
  if (duplicates(cellRefs).length > 0) errors.push('$.input.blindReviewPacket.rasterCells: duplicate cellRef values are forbidden');
  if (duplicates(imageRefs).length > 0) errors.push('$.input.blindReviewPacket.rasterCells: duplicate raster evidence is forbidden');
  const viewKinds = packet.rasterCells.map(({ viewKind }) => viewKind);
  for (const viewKind of ['host-context', 'surface-focus']) {
    if (!viewKinds.includes(viewKind)) errors.push(`$.input.blindReviewPacket.rasterCells: missing ${viewKind} raster`);
  }
  const packetViewports = packet.rasterCells.map(({ viewport }) => viewport);
  for (const viewport of missing(REQUIRED_VIEWPORTS, packetViewports)) errors.push(`$.input.blindReviewPacket.rasterCells: missing ${viewport} raster`);
  if (!viewKinds.includes('lifecycle')) errors.push('$.input.blindReviewPacket.rasterCells: missing lifecycle raster');
  const rasterRefs = new Set(imageRefs);
  for (const probe of packet.probeCells ?? []) {
    if (probe.applicable && !rasterRefs.has(probe.imageRef)) {
      errors.push(`$.input.blindReviewPacket.probeCells: applicable probe raster ${probe.imageRef} is absent from rasterCells`);
    }
  }
  for (const [category, minimum] of Object.entries(REQUIRED_PROBE_COUNTS)) {
    const categoryCells = packet.probeCells.filter((probe) => probe.category === category);
    const applicableCount = categoryCells.filter((probe) => probe.applicable).length;
    const fullyInapplicable = categoryCells.length >= minimum && categoryCells.every((probe) => !probe.applicable && probe.imageRef === null && probe.reason !== null);
    if (applicableCount > 0 && applicableCount < minimum) errors.push(`$.input.blindReviewPacket.probeCells: ${category} cannot mix partial applicable and inapplicable lifecycle phases`);
    if (applicableCount === 0 && !fullyInapplicable) errors.push(`$.input.blindReviewPacket.probeCells: ${category} requires ${minimum} applicable raster phases or complete evidenced non-applicability`);
  }
  errors.push(...probeCoverageSemantic(packet.probeCells, '$.input.blindReviewPacket.probeCells'));
  return errors;
}

export function visualFidelityOutputSemantic(value) {
  const errors = [];
  const { outcome, result, gaps } = value.output;
  if (result && result.reviewMode !== 'ai-adversarial-pixel') {
    errors.push('$.output.result.reviewMode: visual fidelity requires AI adversarial pixel review');
  }
  if (result) {
    if (visualRoundPurpose(result.visualRound?.number) !== result.visualRound?.purpose) errors.push('$.output.result.visualRound: number and purpose do not match');
    const score = result.auditScore;
    const axes = score?.axes ?? [];
    const expectedAxes = ['business-task-closure', 'ux-flow-state-clarity', 'visual-hierarchy-composition', 'responsive-interaction-resilience', 'consistency-accessibility-cues'];
    if (JSON.stringify(axes.map(({ axis }) => axis)) !== JSON.stringify(expectedAxes)) {
      errors.push('$.output.result.auditScore.axes: five score axes must appear once in canonical order');
    }
    const axisTotal = axes.reduce((total, axis) => total + axis.value, 0);
    if (score && axisTotal !== score.value) errors.push('$.output.result.auditScore.value: must equal the sum of the five axis values');
    if (score?.previousValue === null && score?.delta !== null) errors.push('$.output.result.auditScore.delta: first score must use null delta');
    if (score?.previousValue !== null && score?.delta !== score.value - score.previousValue) errors.push('$.output.result.auditScore.delta: must equal value minus previousValue');
    const expectedScoreStatus = score?.target === null ? 'not-requested' : score.value >= score.target ? 'met-target' : 'below-target';
    if (score?.status !== expectedScoreStatus) errors.push('$.output.result.auditScore.status: does not match value and target');
    if (outcome === 'passed' && score?.value < 9) errors.push('$.output.result.auditScore.value: aggregate passed requires a score of at least 9');
    if (outcome !== 'passed' && score?.value > 8) errors.push('$.output.result.auditScore.value: any non-passing visual verdict caps the score at 8');
    if (result.reviewerModel !== 'gpt-5.6-sol' || result.reviewerCount !== 1 || result.contextIsolation !== 'fresh' || result.forkTurns !== 'none') {
      errors.push('$.output.result: v7.2 visual review requires one fresh-context gpt-5.6-sol reviewer');
    }
    const finalRecord = result.inspectionRecords?.find(({ imageRef }) => imageRef === result.lastScreenshotRef);
    if (!finalRecord) errors.push('$.output.result.lastScreenshotRef: final screenshot needs its own inspection record');
    if (result.lastScreenshotVerdict === 'passed' && finalRecord?.verdict !== 'passed') {
      errors.push('$.output.result.lastScreenshotVerdict: cannot pass over a non-passing final inspection record');
    }
    const packetRasters = result.packetRasterRefs ?? [];
    for (const imageRef of packetRasters) if (!isContentAddressedRasterRef(imageRef)) errors.push(`$.output.result.packetRasterRefs: raster ${imageRef} is not content-addressed`);
    const inspectedRasters = result.inspectionRecords?.map(({ imageRef }) => imageRef) ?? [];
    for (const imageRef of missing(packetRasters, inspectedRasters)) errors.push(`$.output.result.inspectionRecords: missing inspection record for ${imageRef}`);
    for (const imageRef of inspectedRasters.filter((ref) => !packetRasters.includes(ref))) errors.push(`$.output.result.inspectionRecords: ${imageRef} was not in the blind packet`);
    if (!packetRasters.includes(result.lastScreenshotRef)) errors.push('$.output.result.lastScreenshotRef: final screenshot is absent from the blind packet');
  }
  for (const [index, record] of (result?.inspectionRecords ?? []).entries()) {
    const at = `$.output.result.inspectionRecords[${index}]`;
    const lenses = record.lensVerdicts?.map(({ lens }) => lens) ?? [];
    for (const lens of missing(REQUIRED_VISUAL_LENSES, lenses)) errors.push(`${at}.lensVerdicts: missing ${lens}`);
    if (duplicates(lenses).length > 0) errors.push(`${at}.lensVerdicts: duplicate visual lenses are forbidden`);

    const families = record.challengeRecords?.map(({ family }) => family) ?? [];
    for (const family of missing(REQUIRED_CHALLENGE_FAMILIES, families)) {
      errors.push(`${at}.challengeRecords: missing ${family} challenge`);
    }

    const hasLensProblem = record.lensVerdicts?.some(({ verdict }) => verdict === 'problem') ?? false;
    const hasConfirmedChallenge = record.challengeRecords?.some(({ disposition }) => disposition === 'confirmed') ?? false;
    if ((hasLensProblem || hasConfirmedChallenge) && record.verdict !== 'repair') {
      errors.push(`${at}.verdict: a lens problem or confirmed challenge forces repair`);
    }
    if (record.verdict === 'repair' && !hasLensProblem && !hasConfirmedChallenge) {
      errors.push(`${at}.verdict: repair requires a lens problem or confirmed challenge`);
    }
  }
  if (outcome === 'passed') {
    if (!result) return ['$.output.result: passed requires structured inspection records'];
    if (gaps.length > 0) errors.push('$.output.gaps: passed cannot retain gaps');
    if (result.inspectionRecords.some(({ verdict }) => verdict !== 'passed')) {
      errors.push('$.output.result.inspectionRecords: repair verdict forbids aggregate passed');
    }
    if (result.probeRecords.some(({ verdict }) => verdict === 'contradiction')) {
      errors.push('$.output.result.probeRecords: contradiction forbids aggregate passed');
    }
    if (result.inspectionRecords.some((record) =>
      record.lensVerdicts.some(({ verdict }) => verdict === 'problem') ||
      record.challengeRecords.some(({ disposition }) => disposition === 'confirmed'))) {
      errors.push('$.output.result.inspectionRecords: a visual problem or confirmed AI challenge forbids aggregate passed');
    }
    if (result.lastScreenshotVerdict !== 'passed') errors.push('$.output.result.lastScreenshotVerdict: only the final screenshot may close visual PASS');
    if (result.uncertainty !== false) errors.push('$.output.result.uncertainty: unresolved reviewer uncertainty forbids aggregate passed');
  }
  if (outcome === 'repair' && result &&
      !result.inspectionRecords.some(({ verdict }) => verdict === 'repair') &&
      !result.probeRecords.some(({ verdict }) => verdict === 'contradiction')) {
    errors.push('$.output.result: repair requires a visible repair verdict or probe contradiction');
  }
  errors.push(...probeCoverageSemantic(result?.probeRecords, '$.output.result.probeRecords'));
  const imageRefs = result?.inspectionRecords?.map(({ imageRef }) => imageRef) ?? [];
  if (duplicates(imageRefs).length > 0) errors.push('$.output.result.inspectionRecords: duplicate image reviews are forbidden');
  return errors;
}

export function independentReviewOutputSemantic(value) {
  const errors = [];
  const { outcome, result, gaps } = value.output;
  if (outcome === 'passed') {
    if (!result) return ['$.output.result: passed requires independent verdict records'];
    if (gaps.length > 0) errors.push('$.output.gaps: passed cannot retain gaps');
    if (result.inspectionVerdicts.some(({ verdict }) => verdict !== 'passed')) {
      errors.push('$.output.result.inspectionVerdicts: finding forbids aggregate passed');
    }
    if (result.probeVerdicts.some(({ verdict }) => verdict === 'contradiction')) {
      errors.push('$.output.result.probeVerdicts: contradiction forbids aggregate passed');
    }
  }
  if (outcome === 'findings' && result &&
      !result.inspectionVerdicts.some(({ verdict }) => verdict === 'finding') &&
      !result.probeVerdicts.some(({ verdict }) => verdict === 'contradiction')) {
    errors.push('$.output.result: findings requires an inspection finding or probe contradiction');
  }
  errors.push(...probeCoverageSemantic(result?.probeVerdicts, '$.output.result.probeVerdicts'));
  if (result) {
    const refs = result.inspectionVerdicts.map(({ inspectionRef }) => inspectionRef);
    if (!exactSequence(result.inspectionRefs, refs)) errors.push('$.output.result.inspectionVerdicts: must bind one-to-one in inspectionRefs order');
    if (duplicates(refs).length > 0) errors.push('$.output.result.inspectionVerdicts: duplicate raster verdicts are forbidden');
  }
  return errors;
}
