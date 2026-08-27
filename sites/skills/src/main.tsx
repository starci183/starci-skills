import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowCounterClockwise,
  ArrowRight,
  ArrowsLeftRight,
  Binoculars,
  Briefcase,
  Bug,
  CheckCircle,
  Chats,
  ClipboardText,
  Code,
  Cube,
  Database,
  Eye,
  FlowArrow,
  FolderOpen,
  FrameCorners,
  Gauge,
  GithubLogo,
  GitBranch,
  HardDrives,
  Lightbulb,
  LinkSimple,
  MagnifyingGlass,
  Palette,
  Pulse,
  RocketLaunch,
  Scales,
  SealCheck,
  ShieldCheck,
  ShieldWarning,
  Sparkle,
  SquaresFour,
  Stack,
  TerminalWindow,
  Wrench,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { Rail, SurfaceCard, SurfaceListCard } from '@starci/grammar/core'
import '@starci/grammar/common.css'
import '@starci/grammar/core.css'
import './styles.css'
import catalog from './catalog.generated.json'

type Skill = (typeof catalog.skills)[number]
type Operator = (typeof catalog.operators)[number]

const pipelines = {
  frontend: [
    ['UI direction', '3–4 visual directions', 'starci-frontend-ui-direction'],
    ['Design critique', 'Independent challenge', 'starci-frontend-design-critique'],
    ['UX flow', 'Navigation, state, recovery', 'starci-frontend-ux-flow'],
    ['Product potential', 'Business and UX opportunities', 'starci-product-potential'],
    ['UI detail', 'Executable screen specification', 'starci-frontend-ui-detail'],
    ['Contract plan', 'Grammar and component boundaries', 'starci-frontend-contract-plan'],
    ['Implementation', 'Bounded source mutation', 'starci-frontend-implementation'],
    ['Visual fidelity', 'Render-to-baseline proof', 'starci-frontend-visual-fidelity'],
    ['Product UAT', 'Journey and outcome proof', 'starci-product-uat'],
  ],
  architecture: [
    ['Discover', 'Observed system model', 'starci-architecture-discover'],
    ['Data ownership', 'Writes, stores, consistency', 'starci-data-ownership-model'],
    ['Option design', 'Material alternatives', 'starci-architecture-option-design'],
    ['Critique', 'Falsification before approval', 'starci-architecture-critique'],
    ['Realization', 'Code and deployment binding', 'starci-architecture-realization'],
  ],
  backend: [
    ['Solution design', 'Behavior before code', 'starci-backend-solution-design'],
    ['Contract plan', 'API, event, transaction, data', 'starci-backend-contract-plan'],
    ['Contract critique', 'Independent contradiction hunt', 'starci-backend-contract-critique'],
    ['Implementation', 'Frozen boundary mutation', 'starci-backend-implementation'],
    ['Proof', 'Semantic and architecture checks', 'starci-backend-proof'],
  ],
} as const

const domainLabels: Record<string, string> = {
  fe: 'Frontend',
  be: 'Backend',
  architecture: 'Architecture',
  business: 'Business',
  core: 'Core protocol',
  context: 'Context',
  delivery: 'Delivery',
  deployment: 'Deployment',
  knowledge: 'Knowledge',
  platform: 'Platform',
  quality: 'Quality',
  'tech-stack': 'Tech stack',
  test: 'Testing',
  workspace: 'Workspace',
}

const shortId = (id: string) => id.replace(/^starci-/, '')
const labelFor = (domain: string) => domainLabels[domain] ?? domain.replaceAll('-', ' ')

const skillIconRules: Array<[RegExp, Icon]> = [
  [/workspace-ready$/, FolderOpen],
  [/device-checkpoint$/, HardDrives],
  [/business-/, Briefcase],
  [/quality-audit$/, ShieldCheck],
  [/block-reconcile$/, SquaresFour],
  [/maintenance-apply$/, Wrench],
  [/request-review$/, ClipboardText],
  [/learning-resolve$/, Lightbulb],
  [/surface-reconcile$/, FrameCorners],
  [/workflow-diagnose$/, Bug],
  [/quality-readiness$/, Gauge],
  [/quality-finding-repair$/, Wrench],
  [/quality-debt-repay$/, ArrowCounterClockwise],
  [/rule-binding-audit$/, LinkSimple],
  [/deployment-monitor$/, Pulse],
  [/deployment-recover$/, ShieldCheck],
  [/deployment-rollback$/, ArrowCounterClockwise],
  [/deployment$/, RocketLaunch],
  [/tunnel-reconcile$/, ArrowsLeftRight],
  [/source-index-publish$/, Database],
  [/sonar-service-reconcile$/, Pulse],
  [/observability-reconcile$/, Eye],
  [/conversation-/, Chats],
  [/tech-stack$/, Stack],
  [/ui-direction$/, Palette],
  [/design-critique$/, Scales],
  [/ux-flow$/, FlowArrow],
  [/product-potential$/, Sparkle],
  [/ui-detail$/, FrameCorners],
  [/frontend-contract-plan$/, ClipboardText],
  [/frontend-implementation$/, Code],
  [/visual-fidelity$/, Eye],
  [/product-uat$/, SealCheck],
  [/architecture-discover$/, Binoculars],
  [/data-ownership-model$/, Database],
  [/architecture-option-design$/, FlowArrow],
  [/architecture-critique$/, Scales],
  [/architecture-realization$/, Cube],
  [/backend-solution-design$/, Lightbulb],
  [/backend-contract-plan$/, ClipboardText],
  [/backend-contract-critique$/, ShieldWarning],
  [/backend-implementation$/, TerminalWindow],
  [/backend-proof$/, SealCheck],
]

const iconForSkill = (id: string) => skillIconRules.find(([pattern]) => pattern.test(id))?.[1] ?? Cube

function App() {
  const [pipeline, setPipeline] = useState<keyof typeof pipelines>('frontend')
  const [skillQuery, setSkillQuery] = useState('')
  const [showAllSkills, setShowAllSkills] = useState(false)
  const [operatorQuery, setOperatorQuery] = useState('')
  const [domain, setDomain] = useState('fe')

  const skills = useMemo(() => {
    const query = skillQuery.trim().toLowerCase()
    if (!query) return catalog.skills
    return catalog.skills.filter((skill) => `${skill.id} ${skill.description} ${skill.capability}`.toLowerCase().includes(query))
  }, [skillQuery])

  const operators = useMemo(() => {
    const query = operatorQuery.trim().toLowerCase()
    return catalog.operators.filter((operator) =>
      (domain === 'all' || operator.domain === domain)
      && (!query || `${operator.id} ${operator.accepts.join(' ')} ${operator.emits.join(' ')}`.toLowerCase().includes(query)),
    )
  }, [domain, operatorQuery])

  const visibleSkills = skillQuery.trim() || showAllSkills ? skills : skills.slice(0, 12)

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="StarCi Skills home">
          <img className="brand-mark" src="./starci-logo.png" alt="" />
          <span><strong>StarCi</strong><small>Skills v{catalog.version}</small></span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#pipeline">Pipeline</a>
          <a href="#skills">Skills</a>
          <a href="#operators">Operators</a>
        </nav>
        <a className="button button-quiet" href="https://github.com/starci183/starci-skills" target="_blank" rel="noreferrer">
          View source <GithubLogo aria-hidden="true" />
        </a>
      </header>

      <main id="top">
        <section className="hero section-shell">
          <div className="hero-copy">
            <p className="eyebrow">A capability operating system for AI delivery</p>
            <h1>One request.<br /><span>Only the next skill loads.</span></h1>
            <p className="hero-lede">
              StarCi v6.2 turns scoped requests into small, validated skills. Each skill does one job deeply,
              calls atomic operators, and hands the objective forward with typed state.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#pipeline">Explore the pipeline <ArrowRight aria-hidden="true" /></a>
              <a className="text-link" href="#operators">Browse all operators</a>
            </div>
          </div>
          <div className="hero-system" aria-label="StarCi execution model">
            <img className="hero-art" src="./capability-graph.png" alt="Abstract modular capability graph with connected validation nodes" />
            <div className="system-kicker"><GitBranch aria-hidden="true" /> Routing spine</div>
            {['Natural-language request', 'Global input analysis', 'One specialized skill', 'One atomic operator', 'Validated state or handoff'].map((step, index) => (
              <div className="system-step" key={step}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{step}</strong>
                {index < 4 && <ArrowRight aria-hidden="true" />}
              </div>
            ))}
            <p>Context is loaded at the state that needs it, then purged at the terminal.</p>
          </div>
        </section>

        <section className="metrics section-shell" aria-label="Release metrics">
          <div><strong>{catalog.skills.length}</strong><span>specialized skills</span></div>
          <div><strong>{catalog.operators.length}</strong><span>atomic operators</span></div>
          <div><strong>{catalog.domains.length}</strong><span>operator domains</span></div>
          <div><strong>0</strong><span>lifecycle monoliths</span></div>
        </section>

        <section id="pipeline" className="section-shell section-block">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Typed capability graph</p>
              <h2>Depth without context sprawl</h2>
            </div>
            <p>The previous result becomes a bounded input. A side branch can solve a newly discovered business or backend need, then resume the original objective.</p>
          </div>

          <div className="pipeline-tabs" role="tablist" aria-label="Capability pipelines">
            {(Object.keys(pipelines) as Array<keyof typeof pipelines>).map((key) => (
              <button key={key} role="tab" aria-selected={pipeline === key} onClick={() => setPipeline(key)}>
                {labelFor(key)}
              </button>
            ))}
          </div>

          <div className="pipeline-grid">
            {pipelines[pipeline].map(([title, detail, skillId], index) => (
              <SurfaceCard
                key={title}
                label={`0${index + 1}`.slice(-2)}
                fact={index === 0 ? 'ENTRY' : index === pipelines[pipeline].length - 1 ? 'PROOF' : 'HANDOFF'}
                state={index === pipelines[pipeline].length - 1 ? 'affirmative' : 'neutral'}
              >
                <h3>{title}</h3>
                <p>{detail}</p>
                <code>{shortId(skillId)}</code>
              </SurfaceCard>
            ))}
          </div>

          <SurfaceListCard
            label="Every transition is explicit"
            fact="STATE CONTRACT"
            depth="top"
            items={[
              { id: 'input', label: 'Closed input', description: 'Active facts and passive references are separated before execution.', state: 'affirmative' },
              { id: 'branch', label: 'Machine-owned branch', description: 'If, else, wait, loop, and side branch live in machine.json.', state: 'affirmative' },
              { id: 'output', label: 'Typed output state', description: 'Receipts, findings, terminal code, and handoff reference are validated.', state: 'affirmative' },
              { id: 'cleanup', label: 'Terminal cleanup', description: 'Task-session scratch is purged after completion, rejection, or failure.', state: 'affirmative' },
            ]}
          />
        </section>

        <section id="skills" className="section-shell section-block">
          <div className="section-heading catalog-heading">
            <div>
              <p className="eyebrow">Skill catalog</p>
              <h2>One capability per machine</h2>
            </div>
            <label className="search-box">
              <MagnifyingGlass aria-hidden="true" />
              <span className="sr-only">Search skills</span>
              <input value={skillQuery} onChange={(event) => setSkillQuery(event.target.value)} placeholder="Search 45 skills" />
            </label>
          </div>
          <figure className="section-art capability-art">
            <img src="./skill-families.png" alt="Three families of modular skills connected through one branching execution path" />
            <figcaption>
              <span>Composable by evidence</span>
              <strong>A skill can branch to solve a newly discovered need, then resume the original objective.</strong>
            </figcaption>
          </figure>
          <div className="skill-grid">
            {visibleSkills.map((skill: Skill) => {
              const SkillIcon = iconForSkill(skill.id)
              return (
                <SurfaceCard key={skill.id} label={labelFor(skill.domain)} fact={skill.capability}>
                  <div className="skill-card-heading">
                    <h3>{shortId(skill.id)}</h3>
                    <span className="skill-icon" aria-hidden="true"><SkillIcon size={24} weight="duotone" /></span>
                  </div>
                  <p>{skill.description}</p>
                  <div className="contract-line"><CheckCircle aria-hidden="true" /> Closed input · state machine · validated output</div>
                </SurfaceCard>
              )
            })}
          </div>
          {!skillQuery.trim() && skills.length > 12 && (
            <div className="catalog-actions">
              <button className="button button-quiet" type="button" onClick={() => setShowAllSkills((current) => !current)}>
                {showAllSkills ? 'Show fewer skills' : `Show all ${skills.length} skills`}
              </button>
            </div>
          )}
          <p className="sr-only" aria-live="polite">
            Showing {visibleSkills.length} of {skills.length} skills.
          </p>
          {skills.length === 0 && <p className="empty-state">No capability matches “{skillQuery}”.</p>}
        </section>

        <section id="operators" className="operator-section section-block">
          <div className="section-shell section-heading operator-heading">
            <div>
              <p className="eyebrow">Operator registry</p>
              <h2>Atomic work, inspectable contracts</h2>
            </div>
            <p>Operators never call each other. The current skill state selects one operator, validates its input and output, then routes on an emitted decision.</p>
          </div>
          <figure className="section-shell section-art operator-art">
            <img src="./operator-gates.png" alt="Atomic modules moving one by one through deterministic validation gates" />
            <figcaption><span>Closed boundary</span><strong>Input → execute → validated state</strong></figcaption>
          </figure>
          <div className="section-shell operator-layout">
            <Rail label="Operator domains" mode="sticky" width="standard">
              <div className="domain-list">
                <button className={domain === 'all' ? 'active' : ''} onClick={() => setDomain('all')}>
                  <span>All domains</span><strong>{catalog.operators.length}</strong>
                </button>
                {catalog.domains.map((item) => (
                  <button key={item.id} className={domain === item.id ? 'active' : ''} onClick={() => setDomain(item.id)}>
                    <span>{labelFor(item.id)}</span><strong>{item.operatorCount}</strong>
                  </button>
                ))}
              </div>
            </Rail>
            <div className="operator-browser">
              <div className="operator-toolbar">
                <div><strong>{domain === 'all' ? 'All operators' : `${labelFor(domain)} operators`}</strong><span>{operators.length} contracts</span></div>
                <label className="search-box compact">
                  <MagnifyingGlass aria-hidden="true" />
                  <span className="sr-only">Search operators</span>
                  <input value={operatorQuery} onChange={(event) => setOperatorQuery(event.target.value)} placeholder="Filter operators" />
                </label>
              </div>
              <div className="operator-list">
                {operators.map((operator: Operator) => (
                  <article key={operator.id} className="operator-row">
                    <div className="operator-id"><span>{operator.domain}</span><strong>{operator.id.split('/').slice(1).join('/')}</strong></div>
                    <div className="operator-contract">
                      <span>accepts</span><code>{operator.accepts[0] ?? 'closed input'}</code>
                    </div>
                    <ArrowRight aria-hidden="true" />
                    <div className="operator-contract">
                      <span>emits</span><code>{operator.emits[0] ?? 'validated state'}</code>
                    </div>
                    <div className="knowledge-pill"><Stack aria-hidden="true" /> {operator.knowledgeCount}</div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section-shell closing-section">
          <SurfaceCard label="Release 6.2" fact="SCOPE-AWARE" state="affirmative">
            <div className="closing-card">
              <div>
                <h2>Scope it. Visualize it. Prove it before commit.</h2>
                <p>Multilingual scope normalization, visual design evidence, and bounded static gates keep each delivery on its intended branch.</p>
              </div>
              <a className="button button-primary" href="https://github.com/starci183/starci-skills/issues" target="_blank" rel="noreferrer">
                Share feedback <ArrowRight aria-hidden="true" />
              </a>
            </div>
          </SurfaceCard>
        </section>
      </main>

      <footer className="site-footer section-shell">
        <span>StarCi Skills v{catalog.version}</span>
        <span>Built with @starci/grammar/common + core</span>
      </footer>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
