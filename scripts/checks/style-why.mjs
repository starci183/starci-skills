// style-why.mjs - the why code of a CSS canon lint rule.
//
// The CSS twin of lint-why.mjs. A finding of the code-pattern gate that comes from a stylelint rule of
// @starci/stylelint-canon carries the catalogued why code of the HFS rule that owns it
// (modules/kernel/failure-codes.yaml: title_vi, meaning_vi, causes_vi, nextStep_vi). The map is the single place in
// the runtime that ties a stylelint rule id to a code; tests/style-why.spec.mjs proves every rule of the plugin is
// mapped, the map agrees with the plugin's own `why`, and every mapped code is catalogued with Vietnamese text.

/** Stylelint rule id -> catalogued why code. R61 owns every rule but two. */
export const STYLE_WHY = Object.freeze({
  'starci/token-only': 'FE_STYLE_TOKEN_ONLY',
  'starci/raw-brand-value': 'FE_STYLE_TOKEN_ONLY',
  'starci/no-apply-raw': 'FE_STYLE_TOKEN_ONLY',
  'starci/no-important': 'FE_STYLE_TOKEN_ONLY',
  'starci/globals-shape': 'FE_STYLE_TOKEN_ONLY',
  'starci/globals-import-order': 'FE_STYLE_TOKEN_ONLY',
  'starci/no-token-redefinition': 'FE_STYLE_TOKEN_ONLY',
  'starci/brand-layer-shape': 'FE_STYLE_TOKEN_ONLY',
  'starci/no-css-module': 'FE_STYLE_TOKEN_ONLY',
  'starci/no-class-selector': 'FE_STYLE_TOKEN_ONLY',
  'starci/breakpoint-scale': 'FE_STYLE_TOKEN_ONLY',
  'starci/source-resolves': 'FE_STYLE_SOURCE_UNRESOLVED',
  'starci/no-inline-lint-config': 'HFS_INLINE_SUPPRESSION',
});

/** The why code of a stylelint rule id, or undefined when the rule has none. */
export const whyOfStyleRule = (ruleId) => (typeof ruleId === 'string' ? STYLE_WHY[ruleId] : undefined);
