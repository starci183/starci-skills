# Judge0 coding execution

Source: `src/modules/judge0/` — grading the LeetCode-style coding practice surface (`/practice`) by
submitting code to a Judge0 engine and mapping the verdict back into the domain.

## The three files, and what each is for

- `judge0.service.ts` — calls the Judge0 API with the code plus its input, then polls for / receives
  the result.
- `enums/judge0-status.ts` — the status codes Judge0 itself returns: Accepted, Wrong Answer, Time
  Limit Exceeded, Compilation Error, and the rest.
- `utils/map-verdict.ts` — maps a raw Judge0 status onto the internal verdict enum owned by the
  coding-problem domain. **The raw Judge0 status never reaches GraphQL.** The engine is an
  implementation detail; leaking its status codes into the schema would make swapping or self-hosting
  a different runner a breaking API change.

## Grading is a job, not a request

A submission does not block on Judge0. Submit code, enqueue a grading job, let the worker call
`Judge0Service`, and push the result back over the socket namespace — the client subscribes rather
than polls. See [background-jobs-bullmq](background-jobs-bullmq.md) and
[realtime-socketio](realtime-socketio.md) for the two halves of that path.

## Operational gotcha

Judge0 needs a cgroup sandbox. On a cgroup-v2-only host — which some dev machines are — a self-hosted
Judge0 will not run until the machine is reconfigured for cgroup-v1 compatibility. This is a host
configuration problem, not something to work around in `judge0.service.ts`.
