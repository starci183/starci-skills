# How to read your own scan

`scan-storybook-architecture.mjs` prints what your repo **is**. This file says what those numbers
**mean** — the one thing the tool cannot do for you.

There are deliberately no counts here. A count belongs to one repo on one day, and a count copied
into a document starts rotting the day after it was taken.

```bash
node scripts/scan-storybook-architecture.mjs <path-to-repo>
```

## Failures — the shape is broken

These stop the scan with a non-zero exit, because each is true or false at any size. A repo with a
dozen components and one with a thousand obey them identically.

| What it says | What has happened | What to do |
|---|---|---|
| an import runs against the direction | a lower tier reached upward, so it now depends on the domain above it | move the import, or move the file |
| an atom imports another tier | the moment an atom arranges children it is a composite; only its name is still wrong | rename it and move it |
| a shared tier is copied under an app namespace | two apps now hold two things with one name, and their vocabularies will drift with nothing announcing it | delete the copy, point both at the one home |
| a page imports a vendor component | the page needed a shape, no block offered it, so it built one inline where no other screen can see it | write the block |

## Signals — the shape looks off

These stop nothing. They are ratios, so they mean the same thing at any size, and each is a
question rather than a verdict.

**Composites far outnumber atoms.** The same shape is being assembled over and over instead of
being named once. Each assembly is a chance to assemble it slightly differently, and nothing
catches that — a type checker is perfectly happy with two near-identical cards.

**Many frames.** A frame answers *how things are arranged*, and there are not many ways to arrange
things. Past a handful, some of those frames are composites wearing a frame's name — usually
because they began as arrangement and quietly grew content.

**More pages than blocks.** Pages are building shapes inline. A page should read as a list: which
blocks, in which frames, fed which data. Longer than that, and the shape it built is invisible to
every other screen that will need the same thing.

**Vendor imports above the wrapping layer.** Read the two kinds apart — they are not the same
defect:

| | What it means | The fix |
|---|---|---|
| a vendor **component** | a missing atom — the shape now sits in domain code where nothing can constrain it | write the atom once |
| a vendor **utility** — a class merger, a hook | not a missing atom; it has no shape to wrap | re-export it from `utils/` |

Counting them together overstates the problem, often by half, because helpers are imported far more
widely than components. `--debt` lists the component ones by file and by imported name: usually a
few distinct components repeated many times, which is exactly what makes them worth writing once.

Expect a non-zero number. A repo reporting zero has usually not been measured rather than being
perfectly clean.

## What a healthy shape looks like

In ratios, never in counts:

- **atoms and composites roughly comparable** — the vocabulary and the shapes built from it grow
  together
- **pages far fewer than blocks** — each page gathers several blocks
- **frames few** — arrangement is a small vocabulary

## The test for whether a measurement is worth recording

> Could it have come out otherwise, and would that have meant something?

If the answer is no, the measurement teaches nothing however true it is.

**"Blocks are the largest tier" is the example.** It cannot come out otherwise: blocks carry the
domain, and any real product has more domain than it has vocabulary to describe the domain with. A
repo where atoms outnumber blocks is not unhealthy — it is a component library with no product
attached. So the count says nothing, and the ratio of blocks to **pages** carries all the
information the block tier had to offer.

That measurement used to be in this file, stated as a finding, with its own explanation admitting
it was expected. Admitting a result was expected is the tell.

Apply the same test before adding anything here.

## What not to conclude

**A smaller repo is not behind.** It is smaller. Reading any reference shape as a target is how a
team invents components to reach a number — and inventing components is the exact failure a tier
system exists to prevent.

**One dominant feature area is normal.** When most blocks belong to a single domain, that is not
imbalance; it is where the product actually is. It is also where a tier system pays for itself
first, because that is where the same shapes repeat most.

**Your repo outranks this file.** If the scan and this document disagree, the scan is describing
something real and this is describing an idea.
