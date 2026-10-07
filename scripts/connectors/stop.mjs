const retainChildManager = (name, options, original, manager, current, sameConnectorOwner) => {
  const { env, read, retain } = options;
  try {
    if (retain(current, { manager, child: current.stopReceipt?.child ?? null }) !== true)
      return { failure: { ok: false, effectState: 'unknown', reason: 'connector-stop-record-refused', custody: current, receipt: { manager } } };
    current = read(name, env);
    if (!sameConnectorOwner(current, original)) return { failure: { ok: false, effectState: 'unknown', reason: 'connector-owner-changed', custody: original, receipt: { manager } } };
  } catch (error) { return { failure: { ok: false, effectState: 'unknown', reason: 'connector-stop-record-refused', custody: current, receipt: { manager }, error: String(error?.message ?? error) } }; }
  return { current };
};

const closeConnectorManager = (name, options, original, prior, identity, checks) => {
  const { child, env, read, stop } = options;
  const { closedProcess, sameConnectorOwner } = checks;
  let manager;
  if (closedProcess(prior?.manager, identity)) manager = prior.manager;
  else { try { manager = stop(identity); } catch (error) { manager = { ok: false, error: String(error?.message ?? error) }; } }
  if (!closedProcess(manager, identity)) return { failure: { ok: false, effectState: manager?.outcome === 'refused' ? 'none' : 'unknown', reason: 'connector-manager-closure-unverified', custody: original, receipt: { manager } } };
  let current;
  try { current = read(name, env); } catch (error) { return { failure: { ok: false, effectState: 'unknown', reason: 'connector-state-unreadable', custody: original, receipt: { manager }, error: String(error?.message ?? error) } }; }
  if (!sameConnectorOwner(current, original)) return { failure: { ok: false, effectState: 'unknown', reason: 'connector-owner-changed', custody: original, receipt: { manager } } };
  if (child) {
    const retained = retainChildManager(name, options, original, manager, current, sameConnectorOwner);
    if (retained.failure) return retained;
    current = retained.current;
  }
  return { manager, current };
};

const closeConnectorChild = (current, child, stop, manager, checks) => {
  const { closedChild, closedProcess } = checks;
  let childReceipt = null;
  if (!child) return { childReceipt };
  if (closedChild(current.stopReceipt?.child, current)) childReceipt = current.stopReceipt.child;
  else if (!current.childPid) {
    if (!closedChild(current.childClosure, current)) return { failure: { ok: false, effectState: 'unknown', reason: 'connector-child-custody-unverified', custody: current, receipt: { manager } } };
    childReceipt = current.childClosure;
  } else {
    if (!current.childIdentity || current.childIdentity.pid !== current.childPid)
      return { failure: { ok: false, effectState: 'unknown', reason: 'connector-child-custody-unverified', custody: current, receipt: { manager } } };
    try { childReceipt = { ...stop(current.childIdentity), launchNonce: current.childLaunchNonce }; } catch (error) { childReceipt = { ok: false, error: String(error?.message ?? error) }; }
    if (!closedProcess(childReceipt, current.childIdentity)) return { failure: { ok: false, effectState: 'unknown', reason: 'connector-child-closure-unverified', custody: current, receipt: { manager, child: childReceipt } } };
  }
  return { childReceipt };
};

const commitConnectorStop = (name, options, original, current, manager, childReceipt, checks) => {
  const { child, env, read, retain, commit } = options;
  const { closedChild, sameConnectorOwner } = checks;
  const receipt = { manager, child: childReceipt };
  try {
    if (child) {
      if (retain(current, receipt) !== true) return { ok: false, effectState: 'unknown', reason: 'connector-stop-record-refused', custody: current, receipt };
      current = read(name, env);
      if (!sameConnectorOwner(current, original) || !closedChild(current?.stopReceipt?.child, current))
        return { ok: false, effectState: 'unknown', reason: 'connector-owner-changed', custody: original, receipt };
    }
    if (commit(current, receipt) !== true) return { ok: false, effectState: 'unknown', reason: 'connector-stop-record-refused', custody: current, receipt };
  } catch (error) { return { ok: false, effectState: 'unknown', reason: 'connector-stop-record-refused', custody: current, receipt, error: String(error?.message ?? error) }; }
  return { ok: true, effectState: 'completed', stopped: original.pid, receipt };
};

export function stopConnectorFlow(name, options, checks) {
  const { source, child, env, read, stop } = options;
  let original;
  try { original = read(name, env); } catch (error) { return { ok: false, effectState: 'unknown', reason: 'connector-state-unreadable', error: String(error?.message ?? error) }; }
  if (!original) return { ok: false, effectState: 'unknown', reason: 'connector-custody-missing' };
  if (original.source !== source) return { ok: false, effectState: 'none', reason: 'connector-source-conflict', custody: original };
  const prior = original.stopReceipt;
  if (original.state === 'stopped' && checks.closedProcess(prior?.manager, original.processIdentity)
      && (!child || checks.closedChild(prior?.child, original)))
    return { ok: true, already: true, effectState: 'completed', stopped: original.processIdentity.pid, receipt: prior };
  const identity = original.processIdentity;
  if (!identity || identity.pid !== original.pid) return { ok: false, effectState: 'none', reason: 'connector-process-custody-required', custody: original };
  const managerResult = closeConnectorManager(name, options, original, prior, identity, checks);
  if (managerResult.failure) return managerResult.failure;
  const childResult = closeConnectorChild(managerResult.current, child, stop, managerResult.manager, checks);
  if (childResult.failure) return childResult.failure;
  return commitConnectorStop(name, options, original, managerResult.current, managerResult.manager, childResult.childReceipt, checks);
}
