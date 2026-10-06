function selectedServices(services) {
  if (!Array.isArray(services)) throw new TypeError('credential services must be an array');
  const selected = new Map();
  for (const service of services) {
    const name = typeof service === 'string' ? service : service?.name;
    if (typeof name !== 'string' || !name.trim()) throw new TypeError('credential service selection needs a name');
    selected.set(name, selected.get(name) === true || service?.explicit === true);
  }
  return selected;
}

function requirement(feature, kind, name, present) {
  if (typeof name !== 'string' || !name.trim()) throw new TypeError('normalized credential requirement needs a name');
  return { feature, kind, name, present: present === true };
}

function nativeAccounts(adapters) {
  if (!Array.isArray(adapters)) throw new TypeError('selected credential adapters must be an array');
  const accounts = new Map();
  for (const { provider, card } of adapters) {
    if (typeof provider !== 'string' || !provider.trim() || card?.kind !== 'native-managed-agent'
        || card?.start?.api !== 'orchestration.worker-start' || typeof card.start.agentArgument !== 'string'
        || !card.start.agentArgument.trim()) throw new TypeError('selected adapter has no supported native credential contract');
    const account = { provider, agent: card.start.agentArgument, api: card.start.api };
    accounts.set(JSON.stringify(account), account);
  }
  return [...accounts.values()];
}

function appendAskTunnelRequirements(selected, input, requirements) {
  if (!selected.has('ask-tunnel')) return;
  const cf = input.connectors?.cloudflare;
  if (!['off', 'quick', 'named'].includes(cf?.mode)) throw new TypeError('selected ask tunnel needs normalized cloudflare settings');
  if (cf.mode === 'named') {
    if (cf.auth === 'credentials-file') requirements.push(requirement('ask-tunnel', 'file', 'connectors.cloudflare.credentialsFile', cf.credentialsPresent));
    else if (cf.auth === 'token') requirements.push(requirement('ask-tunnel', 'env', cf.tokenEnv, cf.tokenPresent));
    else throw new TypeError('selected named ask tunnel needs a normalized authentication mode');
  }
}

function appendTelegramRequirements(selected, input, requirements) {
  if (!selected.has('telegram-bridge')) return;
  const tg = input.connectors?.telegram;
  if (typeof tg?.enabled !== 'boolean') throw new TypeError('selected Telegram action needs normalized settings');
  if (tg.enabled || selected.get('telegram-bridge'))
    requirements.push(requirement('telegram-bridge', 'env', tg.botTokenEnv, tg.botTokenPresent));
}

/** Select names and presence only; normalized connector settings and selected native cards remain their owners' data. */
export function credentialRequirements(input = {}) {
  const { services = [], adapters = [], declaredRequirements = [] } = input;
  const selected = selectedServices(services), requirements = [];
  appendAskTunnelRequirements(selected, input, requirements);
  appendTelegramRequirements(selected, input, requirements);
  if (!Array.isArray(declaredRequirements)) throw new TypeError('declared credential requirements must be an array');
  for (const row of declaredRequirements) {
    if (typeof row?.feature !== 'string' || !row.feature.trim() || !['env', 'file', 'config'].includes(row.kind))
      throw new TypeError('declared credential requirement needs a feature and supported kind');
    requirements.push(requirement(row.feature, row.kind, row.name, row.present));
  }
  return { requirements, accountManaged: nativeAccounts(adapters) };
}
