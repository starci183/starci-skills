# Execute `fe/session-continuity`

Invalidate only evidence bound to the failed lease, then ask the centralized Browser/UAT broker to
verify or reacquire an isolated mission lease. Use the Browser's secure authentication mechanism when
authentication is required. Never read or type secrets through ordinary automation, never keep an OTP
challenge across turns, and never restart FE/API to repair identity. On success return the opaque
authenticated lease and resume capture preflight in the same mission.

A handoff reference is not an executable Browser handle. Return `consumer-materialized` only after
the consumer task directly discovers the handed-off tab in its current turn and binds that observation
to `consumerTabRef`. If discovery fails, do not retry symbolic handoffs: retain the same authenticated
lease and return `broker-executed` with an evidence-broker ref. The broker then executes typed action
and capture requests in its owned context and returns source/runtime/principal/state-bound evidence.
