// The route vocabulary and list normalization shared by catalog readers.
export const ROUTE_FIELDS = Object.freeze(['nodeKinds', 'phase', 'intent', 'prerequisites', 'riskHints']);

/** `value` as its string items: asList'd, each trimmed, empties dropped (scalars wrap). */
export const stringItems = (value) => {
  if (value === undefined || value === null) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.map((item) => String(item).trim()).filter(Boolean);
};

export const routeFields = (route) => Object.fromEntries(ROUTE_FIELDS.map((key) => [key, stringItems(route?.[key])]));
