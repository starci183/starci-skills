/**
 * sds.recur.generation-engine's zone conversion half: resolves a rule's nominal local time (an IANA zone
 * plus a local calendar date and HH:MM) to the real UTC instant it is due at, implementing
 * decision.recur.timezone.anchor (resolved fresh from the owner's declared zone, never a fixed offset)
 * and decision.recur.timezone.dst (shift-forward-by-gap on a spring-forward gap,
 * earliest-of-the-two-real-instants on a fall-back fold). Uses only `Intl`/the runtime's own IANA data -
 * no third-party time zone package - per the brief's own instruction to resolve these fixed instants
 * that way.
 */

export interface LocalDateTime {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

export type ZoneResolutionKind = 'normal' | 'gap' | 'fold';

export interface ZoneResolution {
  readonly instant: Date;
  readonly kind: ZoneResolutionKind;
}

/** Formats a UTC instant into its wall-clock parts in `timeZone`. */
function zonedParts(utcMs: number, timeZone: string): LocalDateTime {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(new Date(utcMs))) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

/** The UTC offset (in minutes) such that `wallClockTime = utcInstant + offset`, at the given real instant. */
function offsetMinutesAt(utcMs: number, timeZone: string): number {
  const wall = zonedParts(utcMs, timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0);
  return Math.round((asUtc - utcMs) / 60000);
}

/** The offset genuinely in effect at `utcMs`, refined once so a naive guess-as-UTC instant converges
 * onto the real regime at that instant rather than the regime implied by the guess itself. */
function refinedOffsetMinutes(naiveGuessMs: number, timeZone: string): number {
  const first = offsetMinutesAt(naiveGuessMs, timeZone);
  return offsetMinutesAt(naiveGuessMs - first * 60000, timeZone);
}

function sameWallClock(a: LocalDateTime, b: LocalDateTime): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day && a.hour === b.hour && a.minute === b.minute;
}

/**
 * Resolves a nominal local date + time in `timeZone` to the real UTC instant it means, per
 * decision.recur.timezone.anchor and decision.recur.timezone.dst.
 *
 * Method: the offset in effect at this local calendar day's start and its end are sampled separately
 * (each refined once so a naive guess-as-UTC always lands in its own real regime). If they agree, the
 * day has no transition affecting this time and the nominal time is resolved directly and
 * unambiguously. If they disagree, a transition happens somewhere in this calendar day; the nominal time
 * is tested against both the "pre" (day-start) and "post" (day-end) regime:
 *   - both round-trip to the nominal wall clock -> a fold: two real instants read this local time; take
 *     the earlier one (decision.recur.timezone.dst).
 *   - only one round-trips -> the nominal time is unambiguous, safely before or after the transition.
 *   - neither round-trips -> a gap: this local time never happens; resolving with the pre-transition
 *     offset directly is exactly "the nominal time shifted forward by the size of the gap" once
 *     reformatted in the post-transition offset (decision.recur.timezone.dst).
 */
export function resolveLocalTimeToUtc(timeZone: string, local: LocalDateTime): ZoneResolution {
  const dayStartGuess = Date.UTC(local.year, local.month - 1, local.day, 0, 0, 0);
  const dayEndGuess = Date.UTC(local.year, local.month - 1, local.day, 23, 59, 0);
  const offsetStart = refinedOffsetMinutes(dayStartGuess, timeZone);
  const offsetEnd = refinedOffsetMinutes(dayEndGuess, timeZone);

  const naiveNominal = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, 0);

  if (offsetStart === offsetEnd) {
    return { instant: new Date(naiveNominal - offsetStart * 60000), kind: 'normal' };
  }

  const utcUnderStartOffset = naiveNominal - offsetStart * 60000;
  const utcUnderEndOffset = naiveNominal - offsetEnd * 60000;
  const matchesStart = sameWallClock(zonedParts(utcUnderStartOffset, timeZone), local);
  const matchesEnd = sameWallClock(zonedParts(utcUnderEndOffset, timeZone), local);

  if (matchesStart && matchesEnd) {
    // Fold: both real instants read this local time. Earliest of the two, always.
    const earliest = Math.min(utcUnderStartOffset, utcUnderEndOffset);
    return { instant: new Date(earliest), kind: 'fold' };
  }
  if (matchesStart) {
    return { instant: new Date(utcUnderStartOffset), kind: 'normal' };
  }
  if (matchesEnd) {
    return { instant: new Date(utcUnderEndOffset), kind: 'normal' };
  }
  // Gap: this local time never happens. Resolve with the pre-transition (day-start) offset directly.
  return { instant: new Date(utcUnderStartOffset), kind: 'gap' };
}

/** Parses "HH:MM" into {hour, minute}. */
export function parseLocalTime(time: string): { hour: number; minute: number } {
  const [hourText, minuteText] = time.split(':');
  return { hour: Number(hourText), minute: Number(minuteText) };
}

/** Parses "YYYY-MM-DD" into {year, month, day}. */
export function parseLocalDate(date: string): { year: number; month: number; day: number } {
  const [yearText, monthText, dayText] = date.split('-');
  return { year: Number(yearText), month: Number(monthText), day: Number(dayText) };
}

/** Resolves a rule's `time` (HH:MM) on `localDate` (YYYY-MM-DD) in `timeZone` to a UTC instant. */
export function resolveRuleInstant(timeZone: string, localDate: string, time: string): ZoneResolution {
  const { year, month, day } = parseLocalDate(localDate);
  const { hour, minute } = parseLocalTime(time);
  return resolveLocalTimeToUtc(timeZone, { year, month, day, hour, minute });
}

/** The real calendar date (YYYY-MM-DD), in `timeZone`, that `instant` falls on - used by the generator
 * to find "today" in the rule's own zone at tick time, never the host's own local date. */
export function localDateInZone(timeZone: string, instant: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return formatter.format(instant);
}
