import { useEffect, useState } from 'react';

/** The tabs of the workflow page in display order, also the values accepted from the URL. */
export const workflowTabs = ['units', 'graph', 'attempts', 'decisions', 'why', 'timeline', 'evidence', 'infra'] as const;
/** One tab of the workflow page. */
export type WorkflowTab = (typeof workflowTabs)[number];
/** The milestones of the attempt page in lifecycle order, also the values accepted from the URL. */
export const attemptSteps = ['dispatch', 'run', 'report', 'checks', 'commit', 'verdict', 'land'] as const;
/** One milestone of the attempt page. */
export type AttemptStep = (typeof attemptSteps)[number];
/** The sections of the System page in display order, also the values accepted from the URL. */
export const systemTabs = ['engine', 'sla', 'resources', 'services', 'cleanup', 'land', 'supervisor', 'learning'] as const;
/** One section of the System page. */
export type SystemTab = (typeof systemTabs)[number];
/** The lists of the Decisions page, also the values accepted from the URL. */
export const decisionTabs = ['di', 'asks', 'incidents'] as const;
/** One list of the Decisions page. */
export type DecisionTab = (typeof decisionTabs)[number];

/** Every page the hash router can show, each with the parameters taken from its URL. */
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

const oneOf = <T extends string>(value: string | null, values: readonly T[], fallback: T): T => {
  return values.find((item) => item === value) ?? fallback;
};

const decode = (value: string | undefined): string => {
  if (!value) return '';
  try { return decodeURIComponent(value); } catch { return ''; }
};

/**
 * Turns a location hash into a route, falling back to a default tab for unknown values and to
 * not-found for unknown paths.
 */
export const parseRoute = (hash = window.location.hash): Route => {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  let url: URL;
  try { url = new URL(raw || '/', window.location.origin); }
  catch { return { kind: 'not-found' }; }
  return parseSegments(url.pathname.split('/').filter(Boolean), url.searchParams);
};

const parseSegments = (parts: readonly string[], params: URLSearchParams): Route => {
  if (parts.length === 0) return { kind: 'overview' };
  if (parts[0] === '_kit' && parts.length === 1) return { kind: 'kit' };
  if (parts[0] === 'w' && parts.length === 3) {
    return { kind: 'workflow', project: decode(parts[1]), wf: decode(parts[2]), tab: oneOf(params.get('tab'), workflowTabs, 'units') };
  }
  if (parts[0] === 'a' && parts.length === 3) {
    return { kind: 'attempt', project: decode(parts[1]), attemptId: decode(parts[2]), step: oneOf(params.get('step'), attemptSteps, 'run'), q: params.get('q') ?? '' };
  }
  if (parts[0] === 'decisions' && parts.length === 1) {
    return { kind: 'decisions', tab: oneOf(params.get('tab'), decisionTabs, 'di'), decider: params.get('decider') ?? '', status: params.get('status') ?? '', kindFilter: params.get('kind') ?? '' };
  }
  if (parts[0] === 'system' && parts.length <= 2) {
    return { kind: 'system', tab: oneOf(parts[1] ?? null, systemTabs, 'engine') };
  }
  if (parts[0] === 'logs' && parts.length === 1) return { kind: 'logs', filters: params };
  if (parts[0] === 'analytics' && parts.length === 1) return { kind: 'analytics', project: params.get('project') ?? '' };
  return { kind: 'not-found' };
};

/** Builds the hash link for a route, the inverse of parsing it. */
export const routeHref = (route: Route): string => {
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
    case 'logs': {
      const suffix = route.filters.size ? `?${route.filters}` : '';
      return `#/logs${suffix}`;
    }
    case 'analytics': {
      const suffix = route.project ? `?project=${enc(route.project)}` : '';
      return `#/analytics${suffix}`;
    }
    case 'kit': return '#/_kit';
    case 'not-found': return '#/';
  }
};

/** Moves the browser to a hash link, which the router picks up as a route change. */
export const navigate = (href: string): void => {
  window.location.hash = href.startsWith('#') ? href.slice(1) : href;
};

/** Gives a component the current route and re-renders it whenever the hash changes. */
export const useRoute = (): Route => {
  const [route, setRoute] = useState<Route>(() => parseRoute());
  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return route;
};

/**
 * Names the top-level navigation entry a route belongs to, so the sidebar can mark it as the current
 * page.
 */
export const navKind = (route: Route): 'overview' | 'decisions' | 'system' | 'logs' | 'analytics' | null => {
  if (route.kind === 'workflow' || route.kind === 'attempt') return 'overview';
  if (route.kind === 'overview' || route.kind === 'decisions' || route.kind === 'system' || route.kind === 'logs' || route.kind === 'analytics') return route.kind;
  return null;
};
