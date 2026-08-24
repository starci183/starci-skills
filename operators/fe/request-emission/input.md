# Request emission input

This operator receives unresolved creation obligations after source fit and principle compilation. It runs before any source write.

## Required artifact

The input must validate against `input.schema.json` and provide:

- the current run identity and router facts;
- the approved source boundary;
- one or more request obligations with a stable ID, evidence, intended owner and reason;
- every detected Grammar gap, if any.

`stableId` is the final basename. The only permitted destination is:

```text
.claude/requests/<stable-id>.request.json
```

An obligation may describe a new Product Block, an allowed lower-tier extension, or a missing reusable Grammar capability. It must not contain proposed source code or invent a local substitute for a Grammar gap.

## Accepted routes

The operator accepts either:

- `requests.review / ready` with `grammar-gap`; or
- `requests.review / ready` with `create-required` and without `grammar-gap`.

The input is invalid when two obligations resolve to the same path with different content, when a stable ID contains a path separator, or when the source boundary is not the boundary bound by layout approval.
