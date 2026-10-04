export function topicsOf(store, url) {
  const requested = (url.searchParams.get('topics') ?? 'workers,decisions,system,logs').split(',').map(value => value.trim());
  const projects = store.projects();
  if (!requested.length || requested.length > 30) return null;
  for (const topic of requested) {
    if (['workers', 'decisions', 'system', 'logs'].includes(topic)) continue;
    const match = /^(wf|attempt):([^:]+):([^:]+)$/.exec(topic);
    if (!match || !projects.some(row => row.name === match[2] || row.ledgerId === match[2]) || !match[3]) return null;
  }
  return [...new Set(requested)];
}

export function related(topic, key, projects = []) {
  if (topic === 'system') return key.startsWith('machine:');
  if (topic === 'workers') return !key.startsWith('machine:') || key === 'machine:data_version';
  if (topic === 'decisions') return key.endsWith(':decisions') || key === 'machine:sup_decisions'
    || key === 'machine:deliveries' || key.endsWith(':data_version');
  if (topic === 'logs') return key.endsWith(':logs') || key === 'machine:machine_logs' || key.endsWith(':data_version');
  const match = /^(wf|attempt):([^:]+):/.exec(topic);
  if (!match) return false;
  const project = projects.find(row => row.name === match[2] || row.ledgerId === match[2]);
  // Machine receipts, registry and host-scoped evidence can change independently of the ledger.
  return key.startsWith(`${project?.name ?? match[2]}:`) || key === 'machine:data_version'
    || key === 'machine:provider_reservations';
}
