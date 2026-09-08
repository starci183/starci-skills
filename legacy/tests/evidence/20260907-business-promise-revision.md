# Business promise revision during coordinated delivery

Two Nivo workflows exposed the same missing lifecycle operation on 2026-09-07. Chatbot retained an in-progress promise from an earlier approved mission while the current approved scope added shared Setup, provenance, trusted readiness and exact Test/Apply. Accounting considered creating a second Setup feature authority because its original Accounting promise was also in-progress. Accounting confirmed that Setup had no separate offer, entitlement or settlement and that no second head was published. An artificial rejection cycle or duplicate feature identifier would misrepresent both cases.

The revision adds an in-progress to in-progress publication with a changed normalized promise, the exact previous archived head, current request authority and fingerprinted claims/coverage. Valid unchanged evidence need not be changed for its own sake. Reconciliation remains absent; this transition does not establish implementation.

Review additionally found that per-session worker leases do not serialize separate sessions writing the shared business registry. Publication now holds a cross-process registry lock while rereading and replacing its index, rejects stale plans, and retains unrelated feature heads. Dry-run is read-only. A busy publisher uses the existing source-drift refusal. A crash may leave an inspectable lock or unreferenced immutable objects; this is not a durable transaction over every file.

The isolated candidate passed ten registry cases, including separate publisher processes, stale plans, unchanged promise rejection, retained old object bytes and dry-run byte preservation. The real business operator validator also exercises the approved revision alongside its existing lawful and negative cases. Root reran registry and operator checks after integrating the five reviewed paths into the release candidate.

These are runtime checks. Product source integration, API/PG16 behavior and browser UAT remain separate obligations. This note does not claim release publication.
