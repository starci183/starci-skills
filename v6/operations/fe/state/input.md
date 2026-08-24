# State input

State accepts `state.generate / ready` after the approved flow has been normalized into pages and product Blocks.

The input contains the exact page-model reference and hash, the routed business evidence receipt, and the product Blocks whose behavior needs to be modeled. State is derived from Block responsibility plus business truth; it is not guessed from visual components.

Every state fact must declare provenance as either `business` or `derived-block`. Business provenance points to evidence. Derived Block provenance points to the state or Block rule from which it follows.
