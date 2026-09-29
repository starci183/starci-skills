import { Suspense, lazy, useEffect, useState, type ComponentType } from 'react';
import { Activity, BarChart3, BookOpen, CircleHelp, Moon, PanelsTopLeft, ScrollText, Sun } from 'lucide-react';
import { Button } from './components/ui/button';
import { Enter } from './components/motion';
import { Badge } from './components/ui/badge';
import { SearchBox } from './components/search-box';
import { FeedbackState, PageSkeleton } from './components/feedback-state';
import { useApiQuery, useLiveStatus, useQueryHealth } from './api/query';
import { formatAbsolute, navLabels } from './i18n/vi';
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

function routePage(route: Route): string | null {
  switch (route.kind) {
    case 'overview': return './pages/work/fleet.tsx';
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
    case 'overview': return 'Tổng quan';
    case 'workflow': return `Workflow ${route.wf}`;
    case 'attempt': return `Attempt ${route.attemptId}`;
    case 'decisions': return 'Quyết định';
    case 'system': return 'Hệ thống';
    case 'logs': return 'Nhật ký';
    case 'analytics': return 'Phân tích';
    case 'kit': return 'Bộ thành phần';
    case 'not-found': return 'Không tìm thấy trang';
  }
}

function PageSlot({ route }: { route: Route }) {
  const path = routePage(route);
  if (path == null) return <FeedbackState><strong>Không tìm thấy trang</strong> · Kiểm tra lại đường dẫn. <a href="#/" className="underline">Về Tổng quan</a></FeedbackState>;
  const Page = pages[path];
  if (!Page) return <FeedbackState><strong>Trang đang được chuẩn bị</strong> · Chưa có giao diện cho trang này trong bản build hiện tại.</FeedbackState>;
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
  if (seconds < 90) return `${seconds} giây trước`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} phút trước`;
  return `${Math.round(seconds / 3600)} giờ trước`;
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
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', 'StarCi · Trung tâm theo dõi workflow và vận hành.');
  }, [route]);

  const observedAt = health.latestAt ?? contract.meta?.at ?? null;
  const age = useAgeSeconds(health.latestAt);
  const isStale = health.staleCount > 0 || health.errorCount > 0 || Boolean(contract.error);
  const provenance = [health.sources.length ? `Nguồn: ${health.sources.slice(0, 8).join(', ')}${health.sources.length > 8 ? ` +${health.sources.length - 8}` : ''}` : 'Chưa có nguồn', health.stale.length ? `Chậm: ${health.stale.join(', ')}` : '', health.errorCount ? `${health.errorCount} nguồn lỗi` : ''].filter(Boolean).join(' · ');
  return <div className="app-shell">
    <aside className="shell-sidebar" aria-label="Điều hướng chính">
      <a className="shell-brand" href="#/" aria-label="StarCi · Tổng quan">
        <span className="shell-brand-mark"><img src="/logos/starci-next-blue.png" alt="" aria-hidden="true" /></span>
        <span><strong>StarCi</strong><small>AI Operations Center</small></span>
      </a>
      <nav className="shell-nav" aria-label="Trang">
        {navigation.map(({ kind, href, label, icon: Icon }) => <a className="shell-nav-link" key={kind} href={href} aria-current={selected === kind ? 'page' : undefined}>
          <Icon aria-hidden="true" />{label}
        </a>)}
      </nav>
      <div className="shell-sidebar-footer">
        <div className="flex items-center gap-2"><BookOpen size={14} aria-hidden="true" /><span>Giao diện chỉ đọc</span></div>
        <div className="mt-2">{contract.data ? `${contract.data.projects.length} dự án từ nguồn` : contract.error ? 'Chưa đọc được hợp đồng API' : 'Đang đọc hợp đồng API…'}</div>
      </div>
    </aside>

    <div className="shell-content">
      <header className="shell-header">
        <div className="shell-header-left">
          <span className="shell-live" role="status" data-status={live} title={`${isStale ? 'Một nguồn dữ liệu đang chậm hoặc lỗi. ' : ''}${live === 'live' ? 'Đang nhận cập nhật trực tiếp (SSE)' : live === 'hidden' ? 'Tab đang ẩn nên tạm dừng cập nhật' : 'Đang thăm dò định kỳ'} · ${provenance}`}>
            <span className="shell-live-dot" aria-hidden="true" />
            <span>{live === 'live' ? 'Trực tiếp' : live === 'hidden' ? 'Tạm dừng' : 'Đang thăm dò'}</span>
            {age != null && live !== 'hidden' ? <span className="shell-live-age">· {formatAge(age)}</span> : null}
          </span>
          <span className="shell-header-separator" aria-hidden="true" />
          <span className="shell-last-updated" title={provenance}>{observedAt == null ? 'Chưa có dữ liệu' : `Nguồn: ${formatAbsolute(observedAt)}`}</span>
        </div>
        <div className="shell-header-right">
          <SearchBox />
          <Badge variant="outline" className="shell-readonly">Công khai · chỉ đọc</Badge>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Chuyển sang sáng' : 'Chuyển sang tối'} title={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}>
            {theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
          </Button>
        </div>
      </header>
      <main className="shell-main" id="main-content"><PageSlot route={route} /></main>
    </div>

    <nav className="shell-bottom-nav" aria-label="Điều hướng điện thoại">
      {navigation.map(({ kind, href, label, icon: Icon }) => <a key={kind} href={href} aria-current={selected === kind ? 'page' : undefined}>
        <Icon aria-hidden="true" />{label}
      </a>)}
    </nav>
  </div>;
}
