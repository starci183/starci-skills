# backend.generate

Implements one backend outcome inside an explicit mutable-path and behavior contract. It records one
local source commit, exact before/after mutations, and raw proof results. It never applies migrations
to a shared environment, invents business rules, or publishes the commit.

The criteria loop inspects the real diff and proof transcripts. Failed criteria produce concrete
feedback, a targeted source or record repair, and reassessment; a repeated unchanged failure cannot
be returned as done.
