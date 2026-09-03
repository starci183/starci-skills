import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowRight,
  ArrowUDownLeft,
  ArrowsSplit,
  BookOpen,
  Cube,
  FlowArrow,
  GithubLogo,
  Globe,
  HandPalm,
  MagnifyingGlass,
  Path,
  Prohibit,
  Repeat,
  Stack,
  Textbox,
  Warning,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { CoreGrammarRoot, Rail, StaticStateRow, SurfaceCard, SurfaceListCard } from '@starci/grammar/core'
import '@starci/grammar/common.css'
import '@starci/grammar/core.css'
import './styles.css'
import catalog from './catalog.generated.json'

type Operator = (typeof catalog.operators)[number]
type Workflow = (typeof catalog.workflows)[number]
type StopCode = (typeof catalog.stopCodes)[number]

const DOCS_HREF = '/docs/'
const SOURCE_HREF = 'https://github.com/starci183/starci-skills'

const domainLabels: Record<string, string> = {
  architecture: 'Architecture',
  backend: 'Backend',
  business: 'Business',
  content: 'Content',
  deployment: 'Deployment',
  frontend: 'Frontend',
  git: 'Git',
  platform: 'Platform',
  quality: 'Quality',
  test: 'Test',
  workspace: 'Workspace',
}
const labelFor = (domain: string) => domainLabels[domain] ?? domain.replaceAll('-', ' ')

const operatorIcons: Array<[RegExp, Icon]> = [
  [/^workspace\./, Path],
  [/^frontend\./, Textbox],
  [/^backend\./, Stack],
  [/^quality\./, Warning],
  [/^git\./, ArrowsSplit],
  [/^release\./, FlowArrow],
]
const iconForOperator = (id: string) => operatorIcons.find(([pattern]) => pattern.test(id))?.[1] ?? Cube

// The hero panel draws the loop exactly as SKILL.md states it, split on its own arrows.
const loopStages = catalog.loop.diagram.split('->').map((stage) => stage.trim()).filter(Boolean)

const requirementNote = (operator: Operator) => {
  const required = operator.inputs.filter((input) => input.required).length
  if (operator.inputs.length === 0) return 'no input kind; it opens a chain'
  return `${operator.inputs.length} input kind${operator.inputs.length === 1 ? '' : 's'}, ${required} required`
}

function OperatorRow({ operator, open, onToggle }: { operator: Operator; open: boolean; onToggle: () => void }) {
  const OperatorIcon = iconForOperator(operator.id)
  return (
    <article className={`operator-row${open ? ' is-open' : ''}`}>
      <button className="operator-summary" type="button" aria-expanded={open} onClick={onToggle}>
        <span className="operator-icon" aria-hidden="true"><OperatorIcon size={22} weight="duotone" /></span>
        <span className="operator-id"><span>{labelFor(operator.domain)} · {operator.profile}</span><strong>{operator.id}</strong></span>
        <span className="operator-contract">
          <span>inputs</span>
          <code>{operator.inputs.map((input) => input.kind).join(', ') || 'none'}</code>
        </span>
        <ArrowRight aria-hidden="true" />
        <span className="operator-contract">
          <span>outputs</span>
          <code>{operator.outputs.map((output) => output.kind).join(', ')}</code>
        </span>
        <span className="operator-counts">
          <span>{operator.steps} steps</span>
          <span>{operator.stops.length} stops</span>
        </span>
      </button>
      {open && (
        <div className="operator-detail">
          <p className="operator-job">{operator.job}</p>
          <dl>
            <div>
              <dt>Context it may read</dt>
              <dd>{operator.context.map((alias) => <code key={alias}>{alias}</code>)}</dd>
            </div>
            <div>
              <dt>Contract</dt>
              <dd>{requirementNote(operator)} · {operator.requirements} requirement fields · {operator.outputs.length} output kinds</dd>
            </div>
            <div>
              <dt>Tools it may call</dt>
              <dd>
                {operator.tools.map((tool) => <code key={tool.id}>{tool.id}:{tool.mode}</code>)}
                {' · '}grammar bound <code>{operator.grammarBound ? 'yes' : 'no'}</code>
              </dd>
            </div>
            <div>
              <dt>Stops with</dt>
              <dd>{operator.stops.map((stop) => (
                <code key={stop.code} className={stop.disposition === 'fallback' ? 'code-fallback' : undefined}>{stop.code}</code>
              ))}</dd>
            </div>
            <div>
              <dt>Next</dt>
              <dd>
                <ul className="next-list">
                  {operator.next.map((next) => <li key={`${next.when}${next.operator}`}>{next.when} → <code>{next.operator}</code></li>)}
                </ul>
              </dd>
            </div>
          </dl>
        </div>
      )}
    </article>
  )
}

function WorkflowCard({ workflow, language }: { workflow: Workflow; language: 'en' | 'vi' }) {
  return (
    <SurfaceCard label={workflow.id} fact={`${workflow.stepCount} STEPS`} state={workflow.ends === 'user' ? 'neutral' : 'affirmative'}>
      <p className="workflow-when" lang={language}>{workflow.when[language]}</p>
      <ol className="workflow-chain">
        {workflow.steps.map((step, index) => (
          <li key={`${workflow.id}-${index}`} className={step.length > 1 ? 'is-parallel' : undefined}>
            <span className="workflow-step-number">{String(index + 1).padStart(2, '0')}</span>
            <span className="workflow-branches">
              {step.map((branch) => (
                <code key={`${branch.operator}-${branch.fanout ?? ''}`}>
                  {branch.operator}
                  {branch.fanout ? <em> ×{branch.fanout}</em> : null}
                </code>
              ))}
            </span>
          </li>
        ))}
      </ol>
      <div className="workflow-footer">
        <span>ends at <code>{workflow.ends}</code></span>
        {workflow.loops.map((loop) => (
          <span key={`${loop.from}-${loop.to}`} className="workflow-loop">
            <ArrowUDownLeft aria-hidden="true" /> {loop.from} → {loop.to}, max {loop.maxRounds} rounds
          </span>
        ))}
      </div>
    </SurfaceCard>
  )
}

function App() {
  const [domain, setDomain] = useState('all')
  const [operatorQuery, setOperatorQuery] = useState('')
  const [openOperator, setOpenOperator] = useState<string | null>(null)
  const [language, setLanguage] = useState<'en' | 'vi'>('en')
  const [stopQuery, setStopQuery] = useState('')
  const [disposition, setDisposition] = useState<'all' | 'terminate' | 'fallback'>('all')

  const operators = useMemo(() => {
    const query = operatorQuery.trim().toLowerCase()
    return catalog.operators.filter((operator) =>
      (domain === 'all' || operator.domain === domain)
      && (!query || `${operator.id} ${operator.job} ${operator.inputs.map((input) => input.kind).join(' ')} ${operator.outputs.map((output) => output.kind).join(' ')} ${operator.stops.map((stop) => stop.code).join(' ')}`.toLowerCase().includes(query)))
  }, [domain, operatorQuery])

  const stopCodes = useMemo(() => {
    const query = stopQuery.trim().toLowerCase()
    return catalog.stopCodes.filter((code: StopCode) =>
      (disposition === 'all' || code.disposition === disposition)
      && (!query || `${code.code} ${code.domain} ${code.meaning} ${code.scope.join(' ')}`.toLowerCase().includes(query)))
  }, [disposition, stopQuery])

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="StarCi Skills home">
          <img className="brand-mark" src="./starci-logo.png" alt="" />
          <span><strong>StarCi</strong><small>Skills {catalog.version}</small></span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#entry">Entry</a>
          <a href="#workflows">Workflows</a>
          <a href="#operators">Operators</a>
          <a href="#stops">Stop codes</a>
        </nav>
        <div className="header-actions">
          <a className="button button-primary" href={DOCS_HREF}>
            <BookOpen aria-hidden="true" /> Docs
          </a>
          <a className="button button-quiet header-source" href={SOURCE_HREF} target="_blank" rel="noreferrer" aria-label="View source on GitHub">
            <GithubLogo aria-hidden="true" />
          </a>
        </div>
      </header>

      <main id="top">
        <section className="hero section-shell">
          <div className="hero-copy">
            <p className="eyebrow">StarCi Skills {catalog.version} · the runtime tree</p>
            <h1>
              One entry.<br />
              <span>{catalog.counts.operators} operators.</span><br />
              One closed routing map.
            </h1>
            <p className="hero-lede">
              The entry freezes a mission scope, selects the one operator that owns the outcome, and routes between
              operators on typed results. <strong>It does no work of its own: it never decides a value, writes source,
              or judges a result.</strong>
            </p>
            <blockquote className="hero-quote">
              “A response that fails either validator does not route. Prose in <code>response.md</code> does not route.
              Only a validated field of <code>response.json</code> does.”
              <cite>SKILL.md — The loop</cite>
            </blockquote>
            <div className="hero-actions">
              <a className="button button-primary" href={DOCS_HREF}>Read the docs <ArrowRight aria-hidden="true" /></a>
              <a className="text-link" href="#operators">Browse the {catalog.counts.operators} operators</a>
            </div>
          </div>
          <div className="hero-system" aria-label="One branch of the routing loop">
            <img className="hero-art" src="./capability-graph.png" alt="Abstract modular graph of connected validation nodes" />
            <div className="system-kicker"><FlowArrow aria-hidden="true" /> One branch, end to end</div>
            {loopStages.map((stage, index) => (
              <div className="system-step" key={stage}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{stage}</strong>
                {index < loopStages.length - 1 && <ArrowRight aria-hidden="true" />}
              </div>
            ))}
            <p>
              An operator performs one job in one linear pass. It never calls another operator, routes a workflow,
              pauses internally, or returns free-form control instructions.
            </p>
          </div>
        </section>

        <section className="metrics section-shell" aria-label="What the tree contains">
          <div><strong>{catalog.counts.operators}</strong><span>operators, one job each</span></div>
          <div><strong>{catalog.counts.workflows}</strong><span>example workflows</span></div>
          <div><strong>{catalog.counts.routes}</strong><span>routes in the closed map</span></div>
          <div><strong>{catalog.counts.stopCodes}</strong><span>registered stop codes</span></div>
        </section>

        <section id="entry" className="section-shell section-block">
          <div className="section-heading">
            <div>
              <p className="eyebrow">The entry</p>
              <h2>One request finds exactly one owner</h2>
            </div>
            <p>
              A request that names no owner, or two owners whose scopes differ materially, stops at the entry with one
              focused question naming the competing boundaries.
            </p>
          </div>

          <div className="entry-table-frame">
            <table className="entry-table">
              <caption className="sr-only">The Entry table of SKILL.md: which request each operator owns</caption>
              <thead><tr><th scope="col">The request is about</th><th scope="col">First operator</th></tr></thead>
              <tbody>
                {catalog.entry.rows.map((row) => (
                  <tr key={row.operator}>
                    <td>{row.about}</td>
                    <td><code>{row.operator}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="route-kinds">
            <SurfaceListCard label="Where a blocked branch hands to" fact={`${catalog.counts.routes} ROUTES`} depth="top">
              {catalog.loop.kinds.map((kind) => (
                <StaticStateRow
                  key={kind.id}
                  item={{
                    id: kind.id,
                    label: `${kind.id} — ${kind.count} route${kind.count === 1 ? '' : 's'}`,
                    description: kind.meaning,
                    state: kind.id === 'operator' || kind.id === 'resume' ? 'affirmative' : 'neutral',
                  }}
                />
              ))}
            </SurfaceListCard>
            <p className="route-note">
              <code>routing.json</code> is closed and checked: every domain an operator’s stop codes hand to has exactly
              one route, and no route names a domain no code reaches. A missing route is a build failure, not a
              judgement call.
            </p>
          </div>
        </section>

        <section className="section-shell docs-banner">
          <SurfaceCard label="Documentation" fact={`STARCI SKILLS ${catalog.version}`} state="affirmative" wholeAction={{ kind: 'link', href: DOCS_HREF, label: 'Open the documentation' }}>
            <div className="docs-banner-body">
              <div>
                <h2>The full tree, page by page</h2>
                <p>
                  Every operator package, kind contract, stop code and workflow is written out in the documentation
                  site at <code>{DOCS_HREF}</code> — the same files this page counts.
                </p>
              </div>
              <span className="button button-primary docs-banner-cta"><BookOpen aria-hidden="true" /> Open the docs <ArrowRight aria-hidden="true" /></span>
            </div>
          </SurfaceCard>
        </section>

        <section id="workflows" className="section-shell section-block">
          <div className="section-heading catalog-heading">
            <div>
              <p className="eyebrow">Example chains</p>
              <h2>{catalog.counts.workflows} workflows, and the rules for composing another</h2>
            </div>
            <div className="language-toggle" role="group" aria-label="Language of the workflow trigger">
              <button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
              <button type="button" aria-pressed={language === 'vi'} onClick={() => setLanguage('vi')}>VI</button>
            </div>
          </div>
          <p className="section-lede">
            The entry reads the <code>when</code> of every example first. A match is run as written, its presets filling{' '}
            <code>request.json</code>. No match means composing a chain under the same rules the workflow validator
            enforces: every required input produced earlier, no shared write alias inside a step, loops capped, and a
            declared end. English is the runtime authority; the Vietnamese line is a human mirror.
          </p>
          <figure className="section-art">
            <img src="./skill-families.png" alt="Branches of one execution path running in parallel and rejoining" />
            <figcaption>
              <span>Steps of parallel branches</span>
              <strong>At most three agents at once, and two branches of one step never share a write alias.</strong>
            </figcaption>
          </figure>
          <div className="workflow-grid">
            {catalog.workflows.map((workflow) => <WorkflowCard key={workflow.id} workflow={workflow} language={language} />)}
          </div>
        </section>

        <section id="operators" className="operator-section section-block">
          <div className="section-shell section-heading operator-heading">
            <div>
              <p className="eyebrow">Operator packages</p>
              <h2>One job, one pass, one typed result</h2>
            </div>
            <p>
              Each operator is one authored <code>operator.md</code> with <code>operator.json</code>, its own{' '}
              <code>errors.json</code>, a validator and a self-test. Everything below is read from those files at build
              time.
            </p>
          </div>
          <figure className="section-shell section-art operator-art">
            <img src="./operator-gates.png" alt="Atomic modules moving one by one through deterministic validation gates" />
            <figcaption><span>Request → response → route</span><strong>Only a validated field of response.json routes.</strong></figcaption>
          </figure>
          <div className="section-shell operator-layout">
            <Rail label="Operator domains" mode="sticky" width="standard">
              <div className="domain-list">
                <button className={domain === 'all' ? 'active' : ''} onClick={() => setDomain('all')}>
                  <span>All domains</span><strong>{catalog.counts.operators}</strong>
                </button>
                {catalog.domains.map((item) => (
                  <button key={item.id} className={domain === item.id ? 'active' : ''} onClick={() => setDomain(item.id)}>
                    <span>{labelFor(item.id)}</span><strong>{item.operatorCount}</strong>
                  </button>
                ))}
              </div>
              <div className="profile-legend">
                <p>Profiles that run them</p>
                {catalog.profiles.map((profile) => (
                  <span key={profile.id}><code>{profile.id}</code><strong>{profile.operatorCount}</strong></span>
                ))}
              </div>
              <div className="profile-legend">
                <p>Tools they may call</p>
                {catalog.tools.map((tool) => (
                  <span key={tool.id}><code>{tool.id}</code><strong>{tool.declaredBy.length}</strong></span>
                ))}
                {catalog.runtimes.filter((runtime) => runtime.unsupported.length > 0).map((runtime) => (
                  <span key={runtime.id}><code>{runtime.id}</code><strong>no {runtime.unsupported.join(', ')}</strong></span>
                ))}
              </div>
            </Rail>
            <div className="operator-browser">
              <div className="operator-toolbar">
                <div>
                  <strong>{domain === 'all' ? 'All operators' : `${labelFor(domain)} operators`}</strong>
                  <span>{operators.length} packages · {catalog.counts.steps} declared steps in total</span>
                </div>
                <label className="search-box compact">
                  <MagnifyingGlass aria-hidden="true" />
                  <span className="sr-only">Search operators</span>
                  <input value={operatorQuery} onChange={(event) => setOperatorQuery(event.target.value)} placeholder="Filter by id, job, kind, or stop code" />
                </label>
              </div>
              <div className="operator-list">
                {operators.map((operator: Operator) => (
                  <OperatorRow
                    key={operator.id}
                    operator={operator}
                    open={openOperator === operator.id}
                    onToggle={() => setOpenOperator((current) => (current === operator.id ? null : operator.id))}
                  />
                ))}
              </div>
              {operators.length === 0 && <p className="empty-state">No operator matches “{operatorQuery}”.</p>}
            </div>
          </div>
        </section>

        <section id="stops" className="section-shell section-block">
          <div className="section-heading catalog-heading">
            <div>
              <p className="eyebrow">Stop code registry</p>
              <h2>Every wall the runtime is allowed to hit</h2>
            </div>
            <label className="search-box">
              <MagnifyingGlass aria-hidden="true" />
              <span className="sr-only">Search stop codes</span>
              <input value={stopQuery} onChange={(event) => setStopQuery(event.target.value)} placeholder={`Search ${catalog.counts.stopCodes} codes`} />
            </label>
          </div>
          <p className="section-lede">
            A code has exactly one disposition. <strong>terminate</strong> ends the branch blocked;{' '}
            <strong>fallback</strong> performs the named action, records it under <code>## Fallbacks taken</code>, and
            continues. <code>domain</code> is the routing domain the stop hands to. A runtime meeting an unlisted code
            terminates with <code>UNKNOWN_STOP</code>.
          </p>
          <div className="stop-filters" role="group" aria-label="Filter by disposition">
            {(['all', 'terminate', 'fallback'] as const).map((value) => (
              <button key={value} type="button" aria-pressed={disposition === value} onClick={() => setDisposition(value)}>
                {value === 'all' ? `All ${catalog.counts.stopCodes}` : value === 'fallback' ? `Fallback ${catalog.counts.fallbackCodes}` : `Terminate ${catalog.counts.stopCodes - catalog.counts.fallbackCodes}`}
              </button>
            ))}
          </div>
          <div className="stop-list">
            {stopCodes.map((code) => (
              <article key={code.code} className={`stop-row stop-${code.disposition}`}>
                <span className="stop-icon" aria-hidden="true">
                  {code.disposition === 'fallback' ? <Repeat size={18} weight="duotone" /> : <Prohibit size={18} weight="duotone" />}
                </span>
                <div className="stop-id">
                  <strong>{code.code}</strong>
                  <span>{code.shared ? 'every operator' : code.scope.join(', ')}</span>
                </div>
                <p className="stop-meaning">{code.meaning}</p>
                <span className="stop-domain"><HandPalm aria-hidden="true" /> {code.domain}</span>
              </article>
            ))}
          </div>
          {stopCodes.length === 0 && <p className="empty-state">No stop code matches “{stopQuery}”.</p>}
        </section>

        <section className="section-shell closing-section">
          <SurfaceCard label={`Release ${catalog.version}`} fact="RUNTIME TREE" state="affirmative">
            <div className="closing-card">
              <div>
                <h2>Authority lives in the operator schemas, not in a page.</h2>
                <p>
                  <code>git.publish</code> cannot express a force push; <code>release.deploy</code> cannot run without
                  its declared authorization; <code>uat.verify</code> has no field that can hold a credential. If a
                  mission seems to need more than an operator allows, that is the answer, not an obstacle to route
                  around.
                </p>
                <p className="lineage-note"><Globe aria-hidden="true" /> {catalog.lineageNote}</p>
              </div>
              <a className="button button-primary" href={DOCS_HREF}>Read the docs <ArrowRight aria-hidden="true" /></a>
            </div>
          </SurfaceCard>
        </section>
      </main>

      <footer className="site-footer section-shell">
        <span>StarCi Skills {catalog.version} · {catalog.counts.operators} operators · {catalog.counts.kinds} kinds</span>
        <span>Every figure on this page is generated from the tree at build time</span>
        <a className="text-link" href={DOCS_HREF}>Documentation</a>
      </footer>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<CoreGrammarRoot theme="system"><App /></CoreGrammarRoot>)
