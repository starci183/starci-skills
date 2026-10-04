import type { Envelope } from '../../contract';

/** Request coverage is separate from a record's age or domain health. */
export function hasUnavailableSources(meta: Envelope<unknown>['meta'] | null | undefined): boolean {
  return Boolean(meta?.stale?.length || meta?.sources.some(source => source.availability != null && source.availability !== 'available'));
}
