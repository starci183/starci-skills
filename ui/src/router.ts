import { useEffect, useState } from 'react';

export const workflowTabs = ['units', 'graph', 'attempts', 'decisions', 'why', 'timeline', 'evidence', 'infra'] as const;
export type WorkflowTab = (typeof workflowTabs)[number];
export const attemptSteps = ['dispatch', 'run', 'report', 'checks', 'verdict', 'land'] as const;
export type AttemptStep = (typeof attemptSteps)[number];
export const systemTabs = ['engine', 'sla', 'resources', 'services', 'cleanup', 'land', 'supervisor', 'learning'] as const;
export type SystemTab = (typeof systemTabs)[number];
export const decisionTabs = ['di', 'asks', 'incidents'] as const;
export type DecisionTab = (typeof decisionTabs)[number];

export type Route =
  | { kind: 'overview' }
  | { kind: 'workflow'; project: string; wf: string; tab: WorkflowTab }
  | { kind: 'attempt'; project: string; attemptId: string; step: AttemptStep; q: string }
  | { kind: 'decisions'; tab: DecisionTab; decider: string; status: string; kindFilter: string }
  | { kind: 'system'; tab: SystemTab }
  | { kind: 'logs'; filters: URLSearchParams }
  | { kind: 'analytics'; project: string }
  | { kind: 'kit' }
  | { kind: 'not-found' };

function oneOf<T extends string>(value: string | null, values: readonly T[], fallback: T): T {
  return values.find((item) => item === value) ?? fallback;
}

function decode(value: string | undefined): string {
  if (!value) return '';
  try { return decodeURIComponent(value); } catch { return ''; }
}

export function parseRoute(hash = window.location.hash): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  let url: URL;
  try { url = new URL(raw || '/', window.location.origin); }
  catch { return { kind: 'not-found' }; }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length === 0) return { kind: 'overview' };
  if (parts[0] === '_kit' && parts.length === 1) return { kind: 'kit' };
  if (parts[0] === 'w' && parts.length === 3) {
    return { kind: 'workflow', project: decode(parts[1]), wf: decode(parts[2]), tab: oneOf(url.searchParams.get('tab'), workflowTabs, 'units') };
  }
  if (parts[0] === 'a' && parts.length === 3) {
    return { kind: 'attempt', project: decode(parts[1]), attemptId: decode(parts[2]), step: oneOf(url.searchParams.get('step'), attemptSteps, 'run'), q: url.searchParams.get('q') ?? '' };
  }
  if (parts[0] === 'decisions' && parts.length === 1) {
    return { kind: 'decisions', tab: oneOf(url.searchParams.get('tab'), decisionTabs, 'di'), decider: url.searchParams.get('decider') ?? '', status: url.searchParams.get('status') ?? '', kindFilter: url.searchParams.get('kind') ?? '' };
  }
  if (parts[0] === 'system' && parts.length <= 2) {
    return { kind: 'system', tab: oneOf(parts[1] ?? null, systemTabs, 'engine') };
  }
  if (parts[0] === 'logs' && parts.length === 1) return { kind: 'logs', filters: url.searchParams };
  if (parts[0] === 'analytics' && parts.length === 1) return { kind: 'analytics', project: url.searchParams.get('project') ?? '' };
  return { kind: 'not-found' };
}

export function routeHref(route: Route): string {
  const enc = encodeURIComponent;
  switch (route.kind) {
    case 'overview': return '#/';
    case 'workflow': return `#/w/${enc(route.project)}/${enc(route.wf)}?tab=${route.tab}`;
    case 'attempt': {
      const query = new URLSearchParams({ step: route.step });
      if (route.q) query.set('q', route.q);
      return `#/a/${enc(route.project)}/${enc(route.attemptId)}?${query}`;
    }
    case 'decisions': {
      const query = new URLSearchParams({ tab: route.tab });
      if (route.decider) query.set('decider', route.decider);
      if (route.status) query.set('status', route.status);
      if (route.kindFilter) query.set('kind', route.kindFilter);
      return `#/decisions?${query}`;
    }
    case 'system': return `#/system/${route.tab}`;
    case 'logs': return `#/logs${route.filters.size ? `?${route.filters}` : ''}`;
    case 'analytics': return `#/analytics${route.project ? `?project=${enc(route.project)}` : ''}`;
    case 'kit': return '#/_kit';
    case 'not-found': return '#/';
  }
}

export function navigate(href: string): void {
  window.location.hash = href.startsWith('#') ? href.slice(1) : href;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute());
  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return route;
}

export function navKind(route: Route): 'overview' | 'decisions' | 'system' | 'logs' | 'analytics' | null {
  if (route.kind === 'workflow' || route.kind === 'attempt') return 'overview';
  if (route.kind === 'overview' || route.kind === 'decisions' || route.kind === 'system' || route.kind === 'logs' || route.kind === 'analytics') return route.kind;
  return null;
}
