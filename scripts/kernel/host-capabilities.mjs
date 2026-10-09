// host-capabilities.mjs - the host facts an op declares it cannot run without, checked by the dispatch before any attempt is spent.
//
// An op manifest names a capability in route.riskHints as `host-capability-required:<id>` (agent host tools are the separate
// `host-tool-required:<tool>` hint of scripts/agent/models.mjs). Each capability has one probe; a probe that finds the host short answers
// the unmet prerequisite the dispatch refuses with (scripts/kernel/prerequisites.mjs), carrying the catalogued code and what provisions it.
import { RENDER_CAPABILITY_HINT, RENDER_TOOL_UNAVAILABLE, renderToolFix, renderToolStatus } from '../work/render-tools.mjs';

const PROBES = Object.freeze({
  [RENDER_CAPABILITY_HINT]: (dirs, options) => {
    const status = renderToolStatus(dirs, options);
    return status.ok ? null : { kind: 'host-capability-missing', code: RENDER_TOOL_UNAVAILABLE, capability: 'render', missing: status.missing.map((item) => item.tool),
      why: status.missing.map((item) => item.why).join('; '), fix: renderToolFix(status.missing) };
  },
});

/** The capabilities `brief` declares: the route.riskHints that name a probe. */
export const capabilitiesOf = (brief) => (Array.isArray(brief?.route?.riskHints) ? brief.route.riskHints : []).filter((hint) => Object.hasOwn(PROBES, hint));

/** The unmet capability prerequisites of `brief` on this host, probed from `dirs` (the tree the op runs in) and the runtime: [{kind, code, capability, missing, why, fix}]. */
export const hostCapabilityGaps = ({ brief, dirs = [], runtime }) => capabilitiesOf(brief).map((hint) => PROBES[hint](dirs, runtime === undefined ? {} : { runtime })).filter(Boolean);
