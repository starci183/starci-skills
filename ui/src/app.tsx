import { Suspense, lazy, useEffect, useState, type ComponentType, type CSSProperties } from 'react';
import { Activity, BarChart3, BookOpen, CircleAlert, CircleHelp, Moon, PanelsTopLeft, ScrollText, Sun } from 'lucide-react';
import { Button } from './components/ui/button';
import { Enter } from './components/motion';
import { Badge } from './components/ui/badge';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from './components/ui/sidebar';
import { SearchBox } from './components/search-box';
import { FeedbackState, PageSkeleton } from './components/feedback-state';
import { useApiQuery, useLiveStatus, useQueryHealth } from './api/query';
import { formatAbsolute, navLabels } from './i18n/vi';
import { t } from './i18n/t';
import { navKind, useRoute, type Route } from './router';
import { applyPreferences, initialTheme, type Theme } from './preferences';
import type { ContractInfo } from './contract';

export const concept = 'frame' as const;

const pageLoaders = import.meta.glob<{ default: ComponentType }>('./pages/**/*.tsx');
const pages = Object.fromEntries(Object.entries(pageLoaders).map(([path, loader]) => [path, lazy(loader)])) as Record<string, ReturnType<typeof lazy>>;

const navigation = [
  { kind: 'overview', href: '#/', label: navLabels.overview, icon: PanelsTopLeft },
  { kind: 'decisions', href: '#/decisions', label: navLabels.decisions, icon: CircleHelp },
  { kind: 'system', href: '#/system/engine', label: navLabels.system, icon: Activity },
  { kind: 'logs', href: '#/logs', label: navLabels.logs, icon: ScrollText },
  { kind: 'analytics', href: '#/analytics', label: navLabels.analytics, icon: BarChart3 },
] as const;

const shellStyle: CSSProperties & { '--sidebar-width': string } = { '--sidebar-width': 'var(--shell-sidebar-width)' };

function routePage(route: Route): string | null {
  switch (route.kind) {
    case 'overview': return './pages/work/workers.tsx';
    case 'workflow': return './pages/work/workflow.tsx';
    case 'attempt': return './pages/attempt/attempt.tsx';
    case 'decisions': return './pages/decisions/decisions.tsx';
    case 'system': return './pages/system/system.tsx';
    case 'logs': return './pages/logs/logs.tsx';
    case 'analytics': return './pages/analytics/analytics.tsx';
    case 'kit': return './pages/kit.tsx';
    case 'not-found': return null;
  }
}

function routeTitle(route: Route): string {
  switch (route.kind) {
    case 'overview': return t('Overview');
    case 'workflow': return `Workflow ${route.wf}`;
    case 'attempt': return `Attempt ${route.attemptId}`;
    case 'decisions': return t('Decisions');
    case 'system': return t('System');
    case 'logs': return t('Logs');
    case 'analytics': return t('Analytics');
    case 'kit': return t('Component kit');
    case 'not-found': return t('Page not found');
  }
}

function PageSlot({ route }: { route: Route }) {
  const path = routePage(route);
  if (path == null) return <FeedbackState><strong>{t('Page not found')}</strong> · {t('Check the URL.')} <a href="#/" className="underline">{t('Back to Overview')}</a></FeedbackState>;
  const Page = pages[path];
  if (!Page) return <FeedbackState><strong>{t('Page is being prepared')}</strong> · {t('This page has no UI in the current build.')}</FeedbackState>;
  return <Suspense fallback={<PageSkeleton />}><Enter key={path}><Page /></Enter></Suspense>;
}

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyPreferences(next, 'vi');
  };
  useEffect(() => { applyPreferences(theme, 'vi'); }, [theme]);
  return [theme, toggle];
}

/** Seconds since the last data refresh, re-rendered every second while the tab is visible. */
function useAgeSeconds(at: number | null): number | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) setNow(Date.now()); }, 1000);
    return () => clearInterval(timer);
  }, []);
  return at == null ? null : Math.max(0, Math.round((now - at) / 1000));
}

function formatAge(seconds: number): string {
  if (seconds < 90) return t('{n} seconds ago', { n: seconds });
  if (seconds < 5400) return t('{n} minutes ago', { n: Math.round(seconds / 60) });
  return t('{n} hours ago', { n: Math.round(seconds / 3600) });
}

export default function App() {
  const route = useRoute();
  const selected = navKind(route);
  const live = useLiveStatus();
  const health = useQueryHealth();
  const [theme, toggleTheme] = useTheme();
  const contract = useApiQuery<ContractInfo>('/api/contract', { topics: ['system'], intervalMs: 60_000 });

  useEffect(() => {
    const title = `${routeTitle(route)} · StarCi`;
    document.title = title;
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', t('StarCi · Workflow monitoring and operations hub.'));
  }, [route]);

  const observedAt = health.latestSuccessfulReadAt ?? contract.observedAt;
  const age = useAgeSeconds(observedAt);
  const hasReadIssues = health.staleCount > 0 || health.errorCount > 0 || Boolean(contract.error);
  const readTime = observedAt == null ? t('No data yet') : t('Last successful API read: {at}', { at: formatAbsolute(observedAt) });
  const provenance = [health.sources.length ? t('Sources: {list}', { list: `${health.sources.slice(0, 8).join(', ')}${health.sources.length > 8 ? ` +${health.sources.length - 8}` : ''}` }) : t('No sources'), health.stale.length ? t('Unavailable sources: {list}', { list: health.stale.join(', ') }) : '', health.errorCount ? t('{n} failing queries', { n: health.errorCount }) : ''].filter(Boolean).join(' · ');
  return <SidebarProvider className="app-shell" style={shellStyle} enableKeyboardShortcut={false}>
    <a href="#main-content" className="shell-skip-link" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>{t('Skip to main content')}</a>
    <Sidebar collapsible="none" className="shell-sidebar" role="complementary" aria-label={t('Main navigation')}>
      <SidebarHeader className="shell-sidebar-heading">
        <a className="shell-brand" href="#/" aria-label={t('StarCi · Overview')}>
          <span className="shell-brand-mark"><img src="/logos/starci-blue.png" alt="" aria-hidden="true" /></span>
          <span><strong>StarCi</strong><small>AI Operations Center</small></span>
        </a>
      </SidebarHeader>
      <SidebarContent className="shell-sidebar-navigation">
        <nav className="shell-nav" aria-label={t('Pages')}>
          <SidebarMenu>{navigation.map(({ kind, href, label, icon: Icon }) => <SidebarMenuItem key={kind}>
            <SidebarMenuButton asChild isActive={selected === kind} className="shell-nav-link">
              <a href={href} aria-current={selected === kind ? 'page' : undefined}><Icon aria-hidden="true" /><span>{label}</span></a>
            </SidebarMenuButton>
          </SidebarMenuItem>)}</SidebarMenu>
        </nav>
      </SidebarContent>
      <SidebarFooter className="shell-sidebar-footer">
        <div className="flex items-center gap-2"><BookOpen size={14} aria-hidden="true" /><span>{t('Read-only UI')}</span></div>
        <div className="mt-2">{contract.data ? t('{n} projects from sources', { n: contract.data.projects.length }) : contract.error ? t('Could not read the API contract') : t('Reading the API contract…')}</div>
      </SidebarFooter>
    </Sidebar>

    <div className="shell-content">
      <header className="shell-header">
        <div className="shell-header-left">
          <span className="shell-live" role="status" data-status={live} title={live === 'live' ? t('SSE connection established') : live === 'hidden' ? t('Tab hidden, updates paused') : t('Polling periodically')}>
            <span className="shell-live-dot" aria-hidden="true" />
            <span>{live === 'live' ? t('SSE connected') : live === 'hidden' ? t('Paused') : t('Polling')}</span>
          </span>
          <span className="shell-header-separator" aria-hidden="true" />
          <span className="shell-last-updated min-w-0 truncate" title={[readTime, age == null ? '' : formatAge(age), provenance].filter(Boolean).join(' · ')}>{readTime}</span>
          {hasReadIssues && <span className="shell-source-health" data-status={health.errorCount || contract.error ? 'error' : 'stale'} role="status" title={provenance}>
            <CircleAlert size={14} aria-hidden="true" />
            <span>{health.errorCount ? t('{n} failing queries', { n: health.errorCount }) : contract.error ? t('Could not read the API contract') : t('{n} unavailable sources', { n: health.staleCount })}</span>
          </span>}
        </div>
        <div className="shell-header-right">
          <SearchBox />
          <Badge variant="outline" className="shell-readonly">{t('Public · read-only')}</Badge>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={theme === 'dark' ? t('Switch to light theme') : t('Switch to dark theme')} title={theme === 'dark' ? t('Light theme') : t('Dark theme')}>
            {theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
          </Button>
        </div>
      </header>
      <main className="shell-main" id="main-content" tabIndex={-1} aria-label={routeTitle(route)}><PageSlot route={route} /></main>
    </div>

    <nav className="shell-bottom-nav" aria-label={t('Mobile navigation')}>
      {navigation.map(({ kind, href, label, icon: Icon }) => <a key={kind} href={href} aria-current={selected === kind ? 'page' : undefined}>
        <Icon aria-hidden="true" />{label}
      </a>)}
    </nav>
  </SidebarProvider>;
}
