# Workflow topologies — public evidence

Date: 2026-09-06.

This public note records only the general observations that support the user-level workflow topology
policy. Detailed source-local records retain operational identifiers and are intentionally excluded
from the installed package.

## Independent workflow observation

One observed workflow had one independently confirmable outcome owned by one native task. Planning,
operator runs, nested exchanges and same-session workers remained internal execution details. They
did not create a need for a separate coordinator or a second user-level workflow owner. This is the
observed `solo` boundary.

## Coordinated workflow observation

Another observed run had one native coordinator tracking multiple independently owned peer
workflows. The coordinator used ordinary two-way task messages for assignments, status, evidence
references, feedback, shared-resource ownership and wake conditions. Each peer retained its own
scope, worktree, gates and receipts, while the coordinator tracked ownership and current heads in a
compact index. This is the observed `coordinated` boundary.

A separate multi-mission run also required independent workflow owners to exchange ordinary messages
to agree revisions, leases and file boundaries. It had no dedicated coordinator, so polling and
coordination notes were distributed among the peers. That occurrence demonstrates the coordination
pressure and the need for a named tracking owner; it is not represented as a second observation of
the final dedicated-coordinator shape.

## Limits

Task messages were sufficient coordination transport, but a message did not grant authority, route
an operator or prove an outcome. Peer receipts remained authoritative for peer work, and portfolio
closure still required the coordinator's own validator-accepted evidence after inspecting the peer
outcomes. The observed coordinated run was still active when the policy was written, so this note
does not claim that its peer workflows or portfolio had completed. The observations also do not prove
that every ambiguous natural-language request can be classified without judgement, or that a new
typed message or cross-session receipt protocol is necessary.
