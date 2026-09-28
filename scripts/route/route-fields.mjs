// The route vocabulary and list normalization shared by catalog readers.
export const ROUTE_FIELDS = Object.freeze(['nodeKinds', 'phase', 'intent', 'prerequisites', 'riskHints']);

export const asList = (value) => (value === undefined || value === null ? [] : Array.isArray(value) ? value : [value])
  .map((item) => String(item).trim()).filter(Boolean);

export const routeFields = (route) => Object.fromEntries(ROUTE_FIELDS.map((key) => [key, asList(route?.[key])]));
