# Deliver actual results, not expected outcomes

At each bounded workflow handoff, present a short result in its own task and link
the detailed output. The goal brief and complete goal stay available using
[workflow-goals.md](workflow-goals.md). In manual mode obtain actual approval
before effects. Valid explicit delegation changes who may technically accept,
not the required output or the truth of the checks. Never impersonate a human.

## Result review

Report the selected goal/revision, what actually changed, observed results against
the acceptance criteria, remaining failures or limitations, and the next workflow
or decision. Use a compact expected/actual/status comparison when several criteria
need checking. Keep commands, tested source/build identity and full inventories in
the linked detail. Distinguish pass, fail, skipped, not-run and inconclusive;
an unavailable test is not pass, and returning a success label does not prove the
promised records or external effects exist.

Inspect the actual artifact and relevant boundary before accepting. For a failing
test distinguish product defect, stale fixture/double, environment misconfiguration
and an invalid design assumption. Verify doubles still implement the real called
signature, callbacks, ordering and error behavior; discarded preparation callbacks
can turn a meaningful integration test into an empty successful operation. Keep
the behavioral assertion unless the approved contract actually changed. Re-run
both positive and negative cases after the correct scoped repair. Label real and
doubled boundaries; local Core/provider doubles do not establish production or
real external-provider behavior.

If code violates SDS, repair implementation. If the design itself contradicts SRS
or fails a relevant scenario, revise the affected SDS with its owner and review
importing consumers before implementation continues under a rebound goal. A new
business decision returns to SRS and the actual authorized decision maker. Do not
rewrite expectations or design simply to justify broken code.

Follow [source of trust and specification repair](source-of-trust.md) through
closure: code remains implementation to evaluate, not authority over accepted
Work. A relevant SRS/SDS gap within the assigned repair scope must be corrected,
reviewed and made currently done before its dependent implementation proceeds.
Do not treat a gap report as the finished deliverable or mechanically stamp done
because a test was made green.

## Visual output

- Draw: map significant journey screens, states and needed viewports to reviewed
  images. One direction may need many images. Use the installed Grammar and
  applicable knowledge; do not count an unrelated representative image as coverage.
- Implemented FE: capture the actual served frontend and bind the tested build,
  route, state and viewport. A generated mockup is not a rendered FE screenshot.
- UAT: execute the ordered flows, capture screenshots and real video of the
  interactions and results, verify playback and relevant coverage, and report
  expected versus observed outcomes. A prerecorded demo or screenshots assembled
  into a video are not a recording of executed UAT.
- Keep media in the owning node's `assets/**`, with privacy-safe test data. Display
  relevant images/video in the task when supported; otherwise provide retrievable
  links and name the display limitation. A success summary alone is not delivery.

## Conflict and completion

Before parallel edits, assign one owner to shared contracts, registration roots,
migration ordering and shared test runners. Check current hashes/diffs before
applying another task's patch. Resolve semantic conflict with the producing owner
and consumers; preserve unrelated edits. Do not reset another task's work, accept
the last write by default, or call a merge clean merely because Git has no markers.
Re-test the integrated result, not only each branch in isolation.

Check all terminal Plan criteria after workflow results are accepted. A passed
step does not complete its successors. Changed accepted content remains editable,
but its affected consumers need current verification, not stale done labels.

For an explicitly requested alpha/beta trial, keep actual observed process defects
separate from product defects. Link each runtime change to a reproduced problem
and a focused regression test where executable, then exercise the corrected
workflow on the real trial. Packaging/build/unit checks alone cannot certify
end-to-end usability. Do not bump or publish a beta with missing required media,
unresolved material conflicts, unexecuted terminal flows or falsified acceptance.
Version promotion and external publication remain separately scoped effects.
