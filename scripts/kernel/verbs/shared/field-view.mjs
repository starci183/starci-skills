// field-view.mjs — `--field <path>[,<path>...]` of the Kernel's read verbs: the answer reduced to the named fields (dotted paths, an
// array index as a number), so a seat reads the one value it needs without scripting over the whole JSON.

const valueAt = (root, dotted) => dotted.split('.').filter(Boolean).reduce((node, key) => (node == null ? undefined : node[key]), root);

/** `emit` that answers `{ok, workflowId, fields: {path: value}}` as JSON when `args.field` names paths, else `emit` itself. */
export function fieldEmit(emit, args) {
  if (typeof args.field !== 'string' || !args.field.trim()) return emit;
  const paths = args.field.split(',').map((path) => path.trim()).filter(Boolean);
  return (out) => emit({ ok: out?.ok !== false, workflowId: args.workflow ?? out?.workflowId ?? null, fields: Object.fromEntries(paths.map((path) => [path, valueAt(out, path) ?? null])) }, '', true);
}
