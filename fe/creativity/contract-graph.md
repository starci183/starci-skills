# contract graph

## Definition

A contract graph is the selected design translated into StarCi's ownership layers before JSX. It
shows which page orders the journey, which blocks own product state, which branches assemble
contract nodes, which composites fix reusable arrangements, which leaves render primitives and
which shells isolate vendor mechanics.

The deciding question: **can every node, seam, repeated run, state transition and interaction be
named with exactly one owner?**

## Rules

**GRAPH-1 · Draw ownership from the page downward.**

Use page/layout → block → branch → composite → leaf, with shells beside the content hierarchy as
mechanical boundaries. A lower tier cannot recover a product decision that the page or block failed
to make.

**GRAPH-2 · Reuse the registry by truth, not resemblance.**

Use an existing key only when its named children, cardinality, seam and reason all match. Similar
classes are insufficient; a key whose name lies about its content weakens every later caller.

**GRAPH-3 · Propose new vocabulary with proof.**

For each new contract, leaf, composite, branch, block or shell, state what it owns, why the current
inventory cannot own it honestly, where else it can recur, how it rests and which tests will bind
it. A proposal that exists only to obtain another gap or wrapper is refused.

**GRAPH-4 · Lists carry one recipe and inert item data.**

A list surface receives a contract-bound render component and the data it repeats. Cardinality and
resting count belong to the contract; item actions remain in `on`. Pre-rendered component arrays and
anonymous fragments bypass the grammar.

**GRAPH-5 · Blocks own product behavior; shells own vendor mechanics.**

A block decides grouping, copy, icon meaning, states and product actions. A shell constructs the
complete vendor mechanism. It exposes only the slots the mechanism cannot interpret, such as a
dropdown trigger or a modal body, and accepts typed inert data plus `on` for mechanics it can own.
A dropdown shell therefore builds Dropdown → Popover → Menu → Section → Item itself; it does not
export vendor item/section pieces for a block to assemble. Neither tier absorbs the other's
decisions.

**GRAPH-6 · Structure, data and actions remain separate.**

Contracts and component identities describe structure, `props` carries inert resolved data, and
`on` carries functions. A convenient mixed item object is still a broken boundary.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Start a new component because a page needs a wrapper | The wrapper has no stable responsibility | Find the owner or propose a named contract relationship |
| Reuse a key because its classes look right | Its child grammar and reason may be false | Match name, children, cardinality, seam and why |
| Put product menu choices inside a dropdown shell | The mechanical boundary becomes domain behavior | Let the block supply resolved menu content and actions |
| Pass rendered children or functions through data | Structure and behavior bypass their typed fences | Use contract-bound render identity and `on` |
| Add a leaf for a reusable multi-leaf arrangement | A primitive tier would hide composition | Use a composite when the fixed arrangement is the reusable thing |

## Examples

### Honest reuse

```
weekly goal grid uses a key whose name, two-column cardinality, full internal border and child recipe all match
```

```
weekly goal grid uses the nearest two-column key and patches its missing border in the caller
```

They differ in one thing: whether the contract remains the sole structural owner.
