# Direction lab interface

Plan renders one cohesive case for the requested scope. Two to four selectable directions live
inside that case. A direction is not a separate product, page system or state matrix.

## Required shape

- Copy the shared Preview review-lab asset into the locked Plan artifact root.
- Set the copied lab manifest `phase` to `plan`; only this phase may use directional `state.html` and
  case CSS. Preview switches to executable `candidateUrl` and cannot carry these strings forward.
- Use one `caseId` for the whole single/batch scope.
- Give each direction a stable `directionId` shared by the table, manifest and plan record.
- Show each direction's `posture` beside it. A reader choosing between options is also choosing how
  much to risk, and that is the one comparison a rendered scene cannot make visible on its own.
- Render one representative real-HTML scene per direction by default.
- Add a second scene only when a decision-critical interaction cannot be judged otherwise.
- Put `DIRECTIONAL - NOT AN APPLY BASELINE` in the persistent canvas chrome. Plan HTML compares
  product directions; it is not the source that Apply will port.
- Show owner/block tree, contract keys and `why`, reuse/API proposals, bounded backend enablers,
  assumptions, unknowns and deliberate legacy divergence.
- Prove implementation feasibility beside every direction: each visible anatomy must map either to
  an existing locked StarCi owner/contract or to one exact proposed owner/API delta. A direction
  whose key anatomy cannot be expressed is research material, not a selectable option.
- Keep a complete state manifest, but mark states deferred to Preview rather than faking coverage.

The canvas and source panel consume the same HTML. Screenshots, prose-only options, unrelated live
pages and source text that does not render are not selectable directions.

After selection, Preview rebuilds the winner as an executable candidate from the actual StarCi
runtime, owners, contracts and tokens. Copying Plan HTML forward and merely polishing it is
forbidden because that turns a directional mockup into an implementation promise it never proved.

## Hosting

Use the shared server from the StarCi trust root and the first free port from `8080`. Report path,
URL, PID and stop command. One batch uses one lab. Preview may carry forward the selected thesis,
tree and proposal record, but must rebuild the scene as executable StarCi candidate source in a
separate revision lab. Plan markup and case CSS never cross that boundary.
