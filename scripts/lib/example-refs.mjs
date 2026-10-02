// example-refs.mjs — the ONE runtime source file that may spell a path into the runtime's own examples/
// tree or a product name the runtime legitimately knows (R206, NO_EXAMPLE_COUPLING): every other source
// file reaches these through the constants below, and scripts/checks/check-example-coupling.mjs exempts
// this file's name only - a declared read, never a path allowlist. A constant belongs here only when the
// runtime genuinely reads that tree or names that product at run time; a pointer that can be generic must
// be generic in the file that holds it.

/** The runtime's example tree root. */
export const EXAMPLES_ROOT = 'examples';

/** The generic services-block template a starcistacks follow-up leg is pointed at (S11-02: one template
 *  for every repository - the per-repository blocks it replaced are spec fixtures under
 *  tests/fixtures/starcistacks-services/, never a run-time read). */
export const STACK_DECLARATION_TEMPLATE = `${EXAMPLES_ROOT}/starcistacks-services/template.services.yaml`;

/** The reference app declaration scripts/hfs/derived-fields.mjs samples for per-field slot ownership. */
export const REFERENCE_APP_MANIFEST = `${EXAMPLES_ROOT}/ecommerce-app/hfs.json`;

/** The example app whose installed tree an fe-kit peer link points at by default. */
export const REFERENCE_EXAMPLE_APP = 'ecommerce-app';

/** The grammar css families a product repository may declare (`[data-grammar-family="<id>"]`); the
 *  runtime's own product maps to the core sheet. */
export const GRAMMAR_FAMILIES = Object.freeze({ starci: 'core', nivo: 'nivo' });

/** Display aliases of legacy workflow slugs that predate workflows.display_name (the progress report's
 *  English fallback; the i18n catalog carries the owner's wording for each value). */
export const WORKFLOW_ALIASES = Object.freeze({
  'nivo-app-auth': 'AUTH (sign-in)', 'nivo-workspace-provision': 'WSPV (buy & provision workspace)',
  'nivo-modules-agentos': 'Modules (AgentOS)', 'nivo-collab-group-chat': 'Collab (group chat)',
  'starci-next-work-and-stacks': 'StarCi Next – work & stacks', 'starci-next-base-repos': 'StarCi Next – base repos',
  'miamia-work-and-stacks': 'Mia Mia – work & stacks', 'miamia-base-repos': 'Mia Mia – base repos',
});

/** A feature-folder segment that is only the product's own name - no useful leaf (display-names pathLabel). */
export const PRODUCT_NAME_SEGMENT = /^(nivo|starci|mia)[-\w]*$/i;

/** The closed list of product names this runtime shipped against - the names R206
 *  (check-example-coupling.mjs) refuses anywhere in runtime source outside this file (a retired
 *  name is judged by RT_RETIRED_NAME_LIVE, R207, from modules/kernel/retired-paths.yaml). */
export const PRODUCT_NAMES = Object.freeze(['mia-mia', 'miamia', 'nivo', 'starci-academy', 'ecommerce-app', 'shape-slot']);
