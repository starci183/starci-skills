// draw-beauty.mjs — what a stopped draw loop reports about the Critic's score of its best round: a score under the bar
// (DRAW_BEAUTY_BELOW), or no score (DRAW_CRITIC_MISSING) carrying the typed cause the Critic path recorded
// (modules/kernel/critic.yaml codes: a happy error such as CRITIC_NO_INDEPENDENT_MEMBER, or a bug such as CRITIC_NO_VERDICT).
import { DRAW_BEAUTY_BELOW, DRAW_CRITIC_MISSING } from './draw-loop-metrics.mjs';

/** The findings of the best round `best` against the loop settings `settings` (beautyMin). */
export function beautyFindings(best, settings) {
  if (Number.isFinite(best.beauty) && best.beauty >= Number(settings.beautyMin)) return [];
  if (Number.isFinite(best.beauty)) return [{ code: DRAW_BEAUTY_BELOW, detail: `the critic scored beauty ${best.beauty} (at least ${settings.beautyMin} is the bar)${best.criticFailed?.length ? '; failed ' + best.criticFailed.join(', ') : ''}` }];
  const error = best.critic?.error ? ': ' + String(best.critic.error).slice(0, 300) : ' (drawn with --no-critic)';
  const cause = best.critic?.code ? `${best.critic.code}: ` : '';
  return [{ code: DRAW_CRITIC_MISSING, ...(best.critic?.code ? { cause: best.critic.code } : {}), detail: `${cause}no critic scored round ${best.n}${error} - run finish without --no-critic (it critiques the best round) or fix what the code names (modules/kernel/critic.yaml)` }];
}
