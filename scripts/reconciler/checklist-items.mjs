// The checklist row builders of `start` (scripts/reconciler/start.mjs) and of the row modules split out of it.

/** One checklist row. status green|red|warn; required rows decide the exit code, warn never does. */
export const item = (group, id, name, status, detail = '', { fix = null, required = true } = {}) => ({ group, id, name, status, required: required && status !== 'warn', detail, ...(fix && status !== 'green' ? { fix } : {}) });
export const green = (group, id, name, detail, opts) => item(group, id, name, 'green', detail, opts);
export const red = (group, id, name, detail, fix, opts) => item(group, id, name, 'red', detail, { fix, ...opts });
export const warn = (group, id, name, detail, fix) => item(group, id, name, 'warn', detail, { fix, required: false });
