import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowRight,
  CheckCircle,
  GithubLogo,
  GitBranch,
  MagnifyingGlass,
  Stack,
} from '@phosphor-icons/react'
import { Rail, SurfaceCard, SurfaceListCard } from '@starci/grammar/core'
import '@starci/grammar/common.css'
import '@starci/grammar/core.css'
import './styles.css'
import catalog from './catalog.generated.json'

type Skill = (typeof catalog.skills)[number]
type Operator = (typeof catalog.operators)[number]

const pipelines = {
  frontend: [
    ['UI direction', '3–4 visual directions'],
    ['Design critique', 'Independent challenge'],
    ['UX flow', 'Navigation, state, recovery'],
    ['Product potential', 'Business and UX opportunities'],
    ['UI detail', 'Executable screen specification'],
    ['Contract plan', 'Grammar and component boundaries'],
    ['Implementation', 'Bounded source mutation'],
    ['Visual fidelity', 'Render-to-baseline proof'],
    ['Product UAT', 'Journey and outcome proof'],
  ],
  architecture: [
    ['Discover', 'Observed system model'],
    ['Data ownership', 'Writes, stores, consistency'],
    ['Option design', 'Material alternatives'],
    ['Critique', 'Falsification before approval'],
    ['Realization', 'Code and deployment binding'],
  ],
  backend: [
    ['Solution design', 'Behavior before code'],
    ['Contract plan', 'API, event, transaction, data'],
    ['Contract critique', 'Independent contradiction hunt'],
    ['Implementation', 'Frozen boundary mutation'],
    ['Proof', 'Semantic and architecture checks'],
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

function App() {
  const [pipeline, setPipeline] = useState<keyof typeof pipelines>('frontend')
  const [skillQuery, setSkillQuery] = useState('')
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
              StarCi v6.1 replaces giant lifecycle prompts with small, validated skills. Each skill does one job deeply,
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
            {pipelines[pipeline].map(([title, detail], index) => (
              <SurfaceCard
                key={title}
                label={`0${index + 1}`.slice(-2)}
                fact={index === 0 ? 'ENTRY' : index === pipelines[pipeline].length - 1 ? 'PROOF' : 'HANDOFF'}
                state={index === pipelines[pipeline].length - 1 ? 'affirmative' : 'neutral'}
              >
                <h3>{title}</h3>
                <p>{detail}</p>
                <code>{shortId(catalog.skills.find((skill) => skill.description.toLowerCase().includes(title.toLowerCase().split(' ')[0]))?.id ?? title)}</code>
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
            {skills.map((skill: Skill) => (
              <SurfaceCard key={skill.id} label={labelFor(skill.domain)} fact={skill.capability}>
                <h3>{shortId(skill.id)}</h3>
                <p>{skill.description}</p>
                <div className="contract-line"><CheckCircle aria-hidden="true" /> Closed input · state machine · validated output</div>
              </SurfaceCard>
            ))}
          </div>
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
          <SurfaceCard label="Release 6.1" fact="FEEDBACK-DRIVEN" state="affirmative">
            <div className="closing-card">
              <div>
                <h2>Use it. Challenge it. Make v6.2 complete.</h2>
                <p>Every real-world experience is accepted as evidence. Validated findings become the upgrade path for the next release.</p>
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
