import { isCanonicalReceipt } from './trace.mjs';

const routeIssuedTransitions = new WeakSet();
const routedTransitionByReturn = new WeakMap();

export function recordRouteIssuedTransition(returnReceipt, transitionReceipt) {
  if (!isCanonicalReceipt(returnReceipt) || !isCanonicalReceipt(transitionReceipt)) throw new Error('route transition registry requires canonical receipts');
  if (transitionReceipt.type !== 'TRANSITION' || transitionReceipt.parentId !== returnReceipt.receiptId) throw new Error('route transition must descend from the exact RETURN');
  routeIssuedTransitions.add(transitionReceipt);
  routedTransitionByReturn.set(returnReceipt, transitionReceipt);
  return transitionReceipt;
}

export function isRouteIssuedTransitionReceipt(receipt) {
  return routeIssuedTransitions.has(receipt) && isCanonicalReceipt(receipt);
}

export function routeIssuedTransitionFor(returnReceipt) {
  return routedTransitionByReturn.get(returnReceipt) ?? null;
}
