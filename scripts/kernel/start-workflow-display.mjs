export function launchAuthorityText({ workflowId, goalRevision, goalIdentity, approvedAt, restart, bridge = null }) {
  const goalIdentityLabel = goalIdentity ? ` (${goalIdentity})` : '';
  const goal = `goal revision ${goalRevision}${goalIdentityLabel}`;
  if (bridge) {
    const bridgeReason = bridge.reason ? `: ${String(bridge.reason).replace(/\s+/g, ' ').slice(0, 240)}` : '';
    const restartLine = restart ? [`  ${restart.launcher} started this terminal as Kernel attempt ${restart.attempt} because attempt ${restart.previousAttempt ?? '?'} ${restart.reason}.`] : [];
    return [
      `LAUNCH AUTHORITY: ${workflowId} (${goal}) is a PROVISIONAL bridging workflow the [Supervisor] defined under autopilot`,
      `  (bridge ${bridge.bridgeId ?? '-'}${bridgeReason}). The owner has not approved it and may`,
      '  revert it; it owns only the shared part its goal names, and other workflows wait on its bridge foundation.',
      ...restartLine,
      '  Begin the LOOP now and never ask for a confirmation to start or to continue. Run starci kernel survey, starci kernel status and',
      '  starci kernel foundations; land the bridge foundation (starci kernel foundation --land <name> --proof <what landed>) once the shared',
      '  part is committed and verified, then finish.',
    ].join('\n');
  }
  if (restart) {
    const approvalTime = approvedAt ? `; its first Kernel booted on that approval at ${approvedAt}` : '';
    const priorTerminal = restart.previousTerminal ? ` (terminal ${restart.previousTerminal})` : '';
    return [
      `LAUNCH AUTHORITY: resume ${workflowId} now as its Kernel attempt ${restart.attempt}; ask no one to confirm.`,
      `  Approval: the owner approved ${workflowId} ${goal}${approvalTime}.`,
      `  Launcher: ${restart.launcher} started this terminal because Kernel attempt ${restart.previousAttempt ?? '?'}${priorTerminal} ${restart.reason}.`,
      `  Proof, recorded seconds after this prompt lands: starci kernel status --workflow ${workflowId} shows kernel.attempt ${restart.attempt},`,
      `  kernel.launchedBy ${restart.launchedBy} and kernel.you true; starci kernel survey shows the approved goal. Every runtime wake`,
      '  ends with the Kernel attempt it is for; check it the same way. No person watches this terminal: the runtime',
      '  types this prompt and every wake. Run starci kernel survey and starci kernel status, then do what the frontier names.',
    ].join('\n');
  }
  return [
    `LAUNCH AUTHORITY — the owner approved ${workflowId} (${goal}) through the start-kernel plan gate`,
    '  before this terminal launched. This prompt is that go: begin the LOOP now and never ask for a',
    '  confirmation to start or to continue.',
    '  Watchdog wakes are the runtime\'s authorized cadence, not owner messages: act on each one; a',
    '  launch gate or a confirmation request is never yours to raise (owner rule: the owner never',
    '  approves launch gates). Owner decisions reach you only as asks you file through the api.',
  ].join('\n');
}

export function kernelLaunchStatus({ health, signal, route }) {
  if (health.live) return `LIVE (${signal.token}; ${health.reason}) — will not spawn a second`;
  if (health.hostUnavailable || health.unverified) return `UNPROVEN (${signal.token}; ${health.reason}) — no replacement until Orca proves it dead`;
  if (signal) return `STALE (${signal.token}; ${health.reason}) — will replace on start`;
  if (route.error) return `BLOCKED (${route.error})`;
  return `will start [Kernel] ${route.agent}/${route.model} with orca orchestration worker-start`;
}

function routeLineOf(route) {
  let configPin = '';
  if (route.routedBy === 'config') {
    let pin = 'kernel.model pin';
    if (route.config?.group) pin = 'kernel.group';
    else if (route.config?.agent) pin = 'kernel.agent pin';
    configPin = ` — ${route.config?.file} ${pin}`;
  }
  const routeTarget = route.route ? ` — ${route.route.target} ${route.route.model ?? ''} [${route.route.mode}]` : '';
  const routeError = route.error ? ` — ${route.error}` : '';
  return `  host: orca | agent: ${route.agent ?? '(unresolved)'} | model: ${route.model ?? '(unresolved)'} (routedBy: ${route.routedBy}${configPin}${routeTarget}${routeError})`;
}

function groupLineOf(route, memberLabel) {
  if (!(route.members?.length > 1)) return '';
  const members = route.members.map((member) => {
    const state = member.availability?.state;
    const stateLabel = state && state !== 'available' ? ` (${state})` : '';
    return memberLabel(member) + stateLabel;
  }).join(' → ');
  return `\n  group: ${members} — a no-effect launch refusal falls through to the next member`;
}

export function launchPlanText({ asJson, out, wf, target, chain, route, memberLabel }) {
  if (asJson) return JSON.stringify(out, null, 2);
  const slugLabel = out.slug && out.slug !== out.title ? ` (slug ${out.slug})` : '';
  const opChain = chain ? chain.join(' → ') : 'kernel derives at boot';
  const routeLine = routeLineOf(route);
  const groupLine = groupLineOf(route, memberLabel);
  const budgets = route.config?.budgets;
  const maxOps = `maxOps=${budgets?.maxOps ?? 'unbounded'}`;
  const budgetLine = budgets && Object.values(budgets).some((value) => value != null)
    ? `\n  budgets (config.yaml): ${maxOps}` : '';
  const warningLine = (route.warnings ?? []).map((warning) => `\n  warning: ${warning}`).join('');
  const effortLabel = route.effort ? `  effort=${route.effort}` : '';
  const configFile = out.config.file ?? 'absent — routing falls to route-model';
  return `PLAN — start workflow ${target}\n  title: ${out.title}${slugLabel}\n  phase: ${wf?.phase} | goal rev ${out.goalRevision} (${out.goalIdentity}) | inbox: ${out.inbox}\n  op chain: ${opChain}\n  kernel: ${out.kernel}\n${routeLine}${groupLine}\n  launch: ${out.launch}\n  config: ${configFile}${effortLabel}${budgetLine}${warningLine}\n  command: ${out.command ?? '(unavailable)'}\n  command source: ${out.commandSource ?? '(unavailable)'}`;
}
