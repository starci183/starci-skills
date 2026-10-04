// Request-local provenance; never shares a mutable availability set across requests.
const provenance = Symbol('ui.read.provenance');
export function bindProvenance(request, scope) { request[provenance] = scope; }
export function requestProvenance(request, sources = [], stale = []) {
  const scope = request?.[provenance];
  return { sources: scope?.sourcesOf ? scope.sourcesOf(sources) : sources,
    stale: [...new Set([...stale, ...(scope?.stale ?? [])])].sort() };
}
// Only clocks describing this read are volatile. Recorded source `at` is evidence.
export const stableSources = sources => sources.map(({ readAt: _readAt, ...source }) => source);
