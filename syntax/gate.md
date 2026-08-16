# gate

A shelf is a gate. It takes a defined input, returns a defined output, and the output of one gate is
the input of the next. This file states the five contracts and where the shapes are enforced.

A shelf that holds law but cannot say what it accepts and what it emits is a rulebook, not a gate. It
can still be read by a person; it cannot be run in the chain.

## The chain

```
prompt · image · feedback
  → layouts     → blocks     → principles  → patterns   → lints  → code
```

**The binding constraint: `output` of gate N is `input` of gate N+1.** It is held by
`$ref` between the schema files rather than by anybody remembering, because the failure it prevents
is silent — a gate that emits a shape the next one cannot read looks fine on its own page.

## Where the shape lives

Each shelf carries `gate.schema.json`, JSON Schema draft 2020-12, with `$id` matching its shelf path
and two top-level members, `input` and `output`. A field with a closed set of values declares an
`enum`, and the members of that enum come from measuring the live app — never from invention.

**Each gate resolves to one thing.** Layouts to a composition, blocks to an anatomy, principles to
contracts, patterns to code. Lints does the rest — everything none of them could state as a shape.

**The reason travels in the chain, not in a field.** The first two gates carry a reason with each
decision, because their outputs are choices among legal alternatives and the next gate needs to know
what it may change: told `"rail stacks above content, it does not become a drawer"`, the block gate
knows a drawer is not available to it. From gate 3 on, the output IS the reason — a contract named
for what it holds needs no sentence saying so, and adding one only creates a second version to drift.

## The five contracts

### 1 · layouts

| | |
|---|---|
| **IN** | the business requirement — raw text, an image, or feedback on something already built |
| **OUT** | archetype · the regions and what each holds · which region stays still · what happens when narrow · the screen-level states |
| **Shape** | **3–4 candidates**, plus the index of the one it recommends |

Layouts does not return one answer. It returns several materially different ones and names its
preference, because a single composition arrives wearing the authority of a decision and the first
answer is rarely challenged once it is the only one drawn. Materially different means each candidate
moves a nameable axis — which region holds what, what stays still, the order in which the reader
meets a decision. Three recolourings are one candidate.

### 2 · blocks

| | |
|---|---|
| **IN** | one region from gate 1, with the sentence saying what that region holds |
| **OUT** | which block · its archetype · the full state list · repeating slots and their resting count · what the block decides versus what it receives · which field renders as text and which as a badge |
| **Shape** | **3–4 candidates**, plus a recommendation |

### 3 · principles

| | |
|---|---|
| **IN** | the block anatomy from gate 2 |
| **OUT** | **a composition of contracts** — one entry per node, each with `key`, `classes`, `host` and the named `children` slots with their cardinality |
| **Shape** | one answer |

Principles resolves to contracts. Not a class string beside a note about it — the entries themselves,
the shape that drops straight into the registry.

**One node, one key.** A block holding three nodes resolves to three contracts with three names. A
single key stretched over three nodes has stopped describing any of them, and the compiler can no
longer tell a wrong child from a right one at any of the three.

### Reuse, and the rename it forces

Contracts are meant to be shared. Two nodes that genuinely hold the same shape take the same key, and
that is the point of a registry.

But reuse is only real if the name is precise enough for both uses to be checked against it. Reaching
for an existing key and finding its name too general is not permission to share — it is the moment
the name is wrong. **Rename it to what it actually holds, then share the renamed key.** A key called
`card` accepts the second use because it accepts everything, which is not reuse but the absence of a
constraint.

This is the same test the block gate applies to duplicate components, one layer down: looking alike
is not evidence of being the same thing. At the contract layer the evidence is the name — if a
precise name fits both nodes, they are the same shape; if it takes a vague name to cover both, they
are not.

### Fully decidable

Four checks, all binary: every node has its own key · the key says what it holds · every class is a
member of the closed union · the host is one of the eleven.

**No reason field.** An entry named for what it holds, with typed slots, already states why its
children sit that way, and the derivation that produced it is recorded upstream. A sentence repeating
that is the restatement the naming law exists to prevent. The load moves onto the key, which is the
better place for it: a wrong sentence goes unnoticed, a wrong key shows the wrong child on sight.

### 4 · patterns

| | |
|---|---|
| **IN** | the contract from gate 3 |
| **OUT** | **code** — the file tree, the tier of each file and how it splits, the props types, `export const meta`, the TSX |
| **Shape** | one answer |

Patterns resolves to code. The contract said what the node is; this says which files hold it, which
half fetches and which half draws, and what shape the props take.

Also fully decidable, and for the same reason: every question it answers has a closed answer.
`LeafProps` takes exactly three slots, `BlockProps` exactly two, a data type is declared with `type`
and never `interface`, and the pair is `index.tsx` plus `component.tsx`. A props that carries
`className` is not slightly off — it hands a second owner to the node.

### 5 · lints

| | |
|---|---|
| **IN** | the code from gate 4 |
| **OUT** | **the rest** — every rule the earlier gates could not carry, applied and repaired |
| **Shape** | one answer |

The four gates before this one each resolve to one thing: a composition, an anatomy, a contract, code.
Lints does the rest. It holds what none of them could state as a shape — the things only visible once
real code exists, and only to a machine reading it.

Which is why this is the one gate with no room for judgement at all. Running the real linter is what
makes its score a fact; reading the code against the rules by eye produces a number somebody had to
believe.

## Reading a gate that stops

A gate reaching a question its input cannot answer **stops and asks**. It does not guess, and it does
not pick a default and move on quietly.

Two kinds of silence, and they need different repairs:

- **the gate is silent** — the law does not cover this case. The fix is a rule, and the evidence for
  it is the screen that needed it.
- **the requirement is silent** — the information genuinely is not there, and no law could derive it.
  The fix is a question back to the user, and writing a rule here is the worse outcome: the gate
  becomes confidently wrong instead of honestly stuck.

Telling these apart is the difference between a gate that improves and one that hardens around a
guess. [`proof.md`](proof.md) records which kind each gap turned out to be.
