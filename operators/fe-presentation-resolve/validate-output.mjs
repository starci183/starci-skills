import { validatorFor, runValidatorCli } from './validation.mjs';

/**
 * The scale topics publish an ordinal rule identifier while Tailwind publishes a step number, and
 * the two diverge above the fourth value. Writing the ordinal as the class is the defect this map
 * exists to catch: GAP-5 renders `gap-6`, never `gap-5`.
 */
const ORDINAL_TO_STEP = { 0: '0', 1: '1', 2: '2', 3: '3', 4: '4', 5: '6', 6: '8' };
const SCALE_TOPICS = {
  gap: /^gap(?:-[xy])?-([0-9]+)$/,
  padding: /^p(?:[xytrbse])?-([0-9]+)$/,
  margin: /^-?m(?:[xytrbse])?-([0-9]+|auto)$/,
};
const PREFIX_FOR = {
  gap: 'GAP',
  padding: 'PADDING',
  margin: 'MARGIN',
  surface: 'SURFACE',
  boundary: 'BOUNDARY',
  font: 'FONT',
  tone: 'TONE',
  measure: 'MEASURE',
  'text-flow': 'FLOW',
  overflow: 'OVERFLOW',
};

function ordinalOf(ruleId) {
  const suffix = ruleId.slice(ruleId.lastIndexOf('-') + 1);
  return suffix === 'AUTO' ? 'auto' : Number(suffix);
}

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { outcome, receipt, artifactRefs } = value.output;
  const { status, resolution, findings, failure, resume } = receipt;

  if (outcome !== status) errors.push('output.outcome must equal receipt.status');

  if (outcome === 'resolved') {
    if (resolution === null) errors.push('a resolved receipt requires a resolution');
    if (failure !== null) errors.push('a resolved receipt cannot carry a failure');
    if (resume !== null) errors.push('a resolved receipt cannot carry a resume');
  } else {
    if (resolution !== null) errors.push('a blocked receipt cannot carry a resolution');
    if (failure === null) errors.push('a blocked receipt requires one typed failure');
    else if (failure.retryable && resume === null) errors.push('a retryable failure requires a resume');
    else if (!failure.retryable && resume !== null) errors.push('a non-retryable failure cannot carry a resume');
  }

  const findingKeys = new Set(findings.map((item) => `${item.nodePath}|${item.property}|${item.code}`));
  const decisionKeys = new Set();

  if (resolution !== null) {
    const applied = new Set(resolution.appliedRuleIds);
    if (resolution.appliedRuleIds.length !== applied.size) {
      errors.push('appliedRuleIds must not repeat a rule identifier');
    }
    if (!artifactRefs.includes(resolution.resolvedTreeRef)) {
      errors.push('artifactRefs must register the resolved tree');
    }

    const appOwnedNodes = new Set();
    for (const decision of resolution.decisions) {
      const key = `${decision.nodePath}|${decision.property}`;
      if (decisionKeys.has(key)) {
        errors.push(`node ${decision.nodePath} decides ${decision.property} more than once`);
      }
      decisionKeys.add(key);

      const expectedPrefix = PREFIX_FOR[decision.property];
      if (decision.ruleId !== null && !decision.ruleId.startsWith(`${expectedPrefix}-`)) {
        errors.push(`node ${decision.nodePath} cites ${decision.ruleId} for a ${decision.property} decision`);
      }

      if (decision.owner === 'grammar') {
        if (decision.className !== null) {
          errors.push(`node ${decision.nodePath} writes a class for a ${decision.property} Grammar already owns`);
        }
        if (decision.ruleId === null) {
          errors.push(`node ${decision.nodePath} must name the rule the Grammar owner satisfies`);
        }
      } else {
        if (decision.ruleId === null) {
          errors.push(`node ${decision.nodePath} resolved ${decision.property} without naming a rule`);
        } else if (!applied.has(decision.ruleId)) {
          errors.push(`decision rule ${decision.ruleId} is absent from appliedRuleIds`);
        }
        if (decision.className === null) {
          errors.push(`node ${decision.nodePath} owns ${decision.property} but emits no class`);
        }
        appOwnedNodes.add(decision.nodePath);
      }

      if (decision.owner === 'none') {
        const key = `${decision.nodePath}|${decision.property}|COMMON_CAPABILITY_MISSING`;
        if (!findingKeys.has(key)) {
          errors.push(`node ${decision.nodePath} uses a workaround for ${decision.property} without recording the missing capability`);
        }
      }

      // The ordinal-to-step check. It runs only for the scale topics and only for base rules,
      // because a composite rule deliberately combines several steps on different sides.
      const pattern = SCALE_TOPICS[decision.property];
      if (pattern && decision.className !== null && decision.ruleId !== null) {
        const ordinal = ordinalOf(decision.ruleId);
        const expected = ordinal === 'auto' ? 'auto' : ORDINAL_TO_STEP[ordinal];
        if (expected !== undefined) {
          const steps = decision.className
            .split(/\s+/)
            .map((token) => pattern.exec(token))
            .filter(Boolean)
            .map((match) => match[1]);
          if (steps.length === 0) {
            errors.push(`node ${decision.nodePath} emits no ${decision.property} class for ${decision.ruleId}`);
          } else if (!steps.includes(expected)) {
            errors.push(`node ${decision.nodePath} renders ${decision.ruleId} as ${decision.className}, expected step ${expected}`);
          }
        }
      }
    }

    for (const contract of resolution.contracts) {
      if (!appOwnedNodes.has(contract.nodePath)) {
        errors.push(`node ${contract.nodePath} claims a contract without an application-owned decision`);
      }
      if (new Set(contract.ruleIds).size !== contract.ruleIds.length) {
        errors.push(`node ${contract.nodePath} repeats a rule identifier in its contract`);
      }
      for (const ruleId of contract.ruleIds) {
        if (!applied.has(ruleId)) {
          errors.push(`node ${contract.nodePath} claims unapplied rule ${ruleId}`);
        }
        if (!decisionKeys.has(`${contract.nodePath}|${topicOf(ruleId)}`)) {
          errors.push(`node ${contract.nodePath} claims ${ruleId} without a matching decision`);
        }
      }
    }

    for (const nodePath of appOwnedNodes) {
      if (!resolution.contracts.some((item) => item.nodePath === nodePath)) {
        errors.push(`node ${nodePath} owns a presentation property but publishes no contract`);
      }
    }
  }

  for (const finding of findings) {
    if (resolution === null) continue;
    if (!decisionKeys.has(`${finding.nodePath}|${finding.property}`)) {
      errors.push(`finding on ${finding.nodePath} has no matching ${finding.property} decision`);
    }
  }

  return errors;
});

function topicOf(ruleId) {
  const prefix = ruleId.slice(0, ruleId.lastIndexOf('-'));
  const entry = Object.entries(PREFIX_FOR).find(([, value]) => value === prefix);
  return entry ? entry[0] : prefix.toLowerCase();
}

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
}
