// GitHub workflow `on` supports a scalar event, an event list or an options map.

/** Convert shorthand workflow events into an options map; mappings retain their values. */
export function workflowEventOptions(on, eventName = (event) => event) {
  if (typeof on === 'string') return { [on]: null };
  if (Array.isArray(on)) return Object.fromEntries(on.map((event) => [eventName(event), null]));
  return on;
}
