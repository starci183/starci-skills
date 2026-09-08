# Owner repair evidence — 2026-09-04

Session 20260904-063705-starci-academy-workspace.bind produced a Grammar Tabs behavior proposal but
its presentation step refused: the tree was library-owned, while the app resolution required an
app-owned Rules chosen row. The consumer separately retained a failing external-panel regression
and could not validate delivery. The owner-library path therefore needs its own typed boundary;
an empty or invented app CSS row would not repair the missing ownership contract.

During Nivo identity diagnosis, a Source structured admin credential was printed into tool output.
The corrected investigation in session 20260904-171024-grammar-uat-repair proved internally that
Source and Nivo mounted credentials differ in both username and password. The prior operation had
paired Source custody with Nivo's provider endpoint. No credential values are recorded here.

The same investigation found the product API unavailable while its registry entry still said
ready. Provider discovery was healthy. A provider lookup cannot substitute for product login,
and retrying the same credential would not repair the missing API.

The repaired library passes its external-panel regression after the DOM observer settles. The
consumer's immediate assertion ran before that observer; awaiting the unchanged exact assertion
fails against 0.4.8 and passes against 0.4.9. The dependency boundary preserves that regression and
compares installed release bytes with the published archive, rather than treating a version string
as proof that the repaired code is running.

A dependency installation was initially launched from the host checkout rather than the bound
consumer checkout. It was interrupted and the host dependencies restored without changing tracked
manifests. The dependency runner now derives its working directory from the validated binding and
uses fixed installation arguments. An identity cleanup helper also continued after an external
validator failed; its original request was restored and the ungated cleanup recorded as an incident.
Consuming identity helpers validate the frozen request internally before applying effects.

The user explicitly selected primary pages and their main rendered states as the audit scope,
deferring secondary states. The later request for a separate audit.md on every surface was withdrawn.
The audit contract therefore records selected surfaces and deferred states in existing typed
receipts; it neither creates per-surface files nor claims complete state coverage.

The Nivo frontend and backend are distinct repositories with distinct served commits. The previous
UAT validator bound both frontend admissions to the backend commit, making truthful cross-repository
proof impossible. Provenance now retains each role's commit and validates frontend admissions
against the actual frontend owner receipt. Integrating the repaired consumer into the existing UAT
branch also produced a new merge commit, whose gate evidence must remain attached to that actual
commit instead of borrowing the consumer's earlier verification.

Both the Source administrator rotation and a separately owned Nivo flow provisioning attempt
authenticated successfully but stopped before mutation because their returned tokens omitted role
claims. A read-only provider inspection of the Source principal proved a matching token subject,
server-evaluated management access and the effective global administrator role. The returned
canonical username differed only in case from credential custody. The shared consuming helper now
accepts this bound provider proof, while rejecting a different subject, missing effective role or
denied endpoint; it does not add privileges or infer them from successful authentication alone.
