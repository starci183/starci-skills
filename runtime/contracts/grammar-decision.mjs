import { createHash } from 'node:crypto';
import { validatorFor } from '../../operators/validation.mjs';

const sortValue = (value) => Array.isArray(value)
  ? value.map(sortValue)
  : value !== null && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]))
    : value;

export const fingerprintGrammarDecision = (manifest) => {
  const { manifestFingerprint: _ignored, ...body } = manifest;
  return `sha256:${createHash('sha256').update(JSON.stringify(sortValue(body))).digest('hex')}`;
};

const physicalAuthority = /(^|[/:._-])(px-\d|py-\d|p-\d|m-\d|sticky|top-\d|purple|violet|#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\()/i;
const introTokens = new Map([
  ['eyebrow', ['token://type/text-xs', 'token://color/accent']],
  ['heading', ['token://type/contextual-heading']],
  ['description', ['token://type/text-sm', 'token://color/muted']],
]);

const semanticErrors = (manifest) => {
  const errors = [];
  const decisionRefs = manifest.decisions.map((item) => item.decisionRef);
  if (new Set(decisionRefs).size !== decisionRefs.length) errors.push('$.decisions: decisionRef values must be unique');
  if (JSON.stringify([...decisionRefs].sort()) !== JSON.stringify([...manifest.requiredDecisionRefs].sort())) errors.push('$.requiredDecisionRefs: must exactly cover decisions');
  if (!['@starci/grammar-core', '@starci/grammar-offset-pop'].includes(manifest.grammar.selected.package)) errors.push('$.grammar.selected.package: select exactly Core or Offset Pop');
  if (manifest.manifestFingerprint !== fingerprintGrammarDecision(manifest)) errors.push('$.manifestFingerprint: does not bind the canonical manifest body');

  for (const decision of manifest.decisions) {
    if (physicalAuthority.test([decision.semanticRole, ...decision.tokenRefs].join(' '))) errors.push(`$.decisions.${decision.decisionRef}: raw utility, pixel, sticky, or physical-color authority is forbidden`);
    if (decision.kind === 'sticky' && decision.sticky === undefined) errors.push(`$.decisions.${decision.decisionRef}: sticky lifecycle is required`);
  }

  for (const composition of manifest.semanticComposition) {
    const slots = composition.slots.slice().sort((a, b) => a.order - b.order).map((slot) => slot.slotRef);
    if (composition.patternRef.startsWith('proposal://')) {
      errors.push(`$.semanticComposition.${composition.instanceRef}: unapproved proposals are non-renderable`);
    }
    if (composition.ownerLayer === 'grammar') {
      if (!composition.patternRef.startsWith('pattern://') || !composition.authorityRef.startsWith('grammar://')) {
        errors.push(`$.semanticComposition.${composition.instanceRef}: Grammar ownership requires published pattern and Grammar authority`);
      }
    } else {
      if (!/^(block|composite):\/\//.test(composition.patternRef) || !composition.authorityRef.startsWith('application://')) {
        errors.push(`$.semanticComposition.${composition.instanceRef}: business creativity must remain an application block/composite`);
      }
      if (!manifest.decisions.some((item) => item.ownerRef === composition.ownerRef)) {
        errors.push(`$.semanticComposition.${composition.instanceRef}: application block/composite still requires Grammar-bound decisions`);
      }
    }
    if (composition.patternRef === 'pattern://ContextIntro') {
      if (slots.join(',') !== 'eyebrow,heading,description') errors.push(`$.semanticComposition.${composition.instanceRef}: ContextIntro slots must be eyebrow, heading, description`);
      for (const [slotRef, tokens] of introTokens) {
        const bound = manifest.decisions.filter((item) => item.ownerRef === composition.ownerRef && item.semanticRole === `context-intro.${slotRef}`).flatMap((item) => item.tokenRefs);
        for (const token of tokens) if (!bound.includes(token)) errors.push(`$.semanticComposition.${composition.instanceRef}: ${slotRef} requires ${token}`);
      }
    }
    if (composition.patternRef === 'pattern://RightRail') {
      const bound = manifest.decisions.filter((item) => item.ownerRef === composition.ownerRef && item.semanticRole === 'navigation.right-rail.content').flatMap((item) => item.tokenRefs);
      for (const token of ['token://space/inline-3', 'token://space/block-6']) if (!bound.includes(token)) errors.push(`$.semanticComposition.${composition.instanceRef}: RightRail requires ${token}`);
    }
    const ranges = new Set(manifest.responsiveBindings.filter((item) => item.ownerRef === composition.ownerRef).map((item) => item.range));
    for (const range of ['wide', 'intermediate', 'compact']) if (!ranges.has(range)) errors.push(`$.responsiveBindings: ${composition.ownerRef} is missing ${range}`);
  }
  return errors;
};

export const validateGrammarDecision = validatorFor(new URL('./grammar-decision.schema.json', import.meta.url), semanticErrors);
