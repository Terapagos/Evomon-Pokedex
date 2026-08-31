import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, ExternalLink, Filter, Info, RotateCcw, Search, Sparkles, X } from 'lucide-react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import { type Evomon, type EvomonMove, type MoveTag, evomonData } from '@/data/evomonData';
import { useGetEvomonCatalog } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const WIKI_URL = 'https://www.evomon.wiki/wiki';
const MOVES_URL = 'https://www.evomon.wiki/moves';
type Variant = 'normal' | 'shiny';
const CatalogContext = createContext({ catalog: evomonData, isLoading: true, isError: false });

function useCatalog() {
  return useContext(CatalogContext);
}

const asList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return typeof value === 'string' && value.trim() ? [value] : [];
};
const idFor = (entry: Evomon) => entry.id ?? entry.name.toLowerCase().replaceAll(/\s+/g, '-');
const elementsFor = (entry: Evomon) => asList(entry.element);
const stageFor = (entry: Evomon) => entry.stage || 'Unclassified';
const imageFor = (entry: Evomon, variant: Variant) => variant === 'shiny' ? entry.shinyImage : entry.image;
const statsFor = (entry: Evomon, variant: Variant): Record<string, number> => variant === 'shiny' ? (entry.shinyBaseStats ?? entry.baseStats ?? {}) : (entry.baseStats ?? {});
const missing = 'Not recorded in current wiki notes';

function Artwork({ entry, variant, large = false }: { entry: Evomon; variant: Variant; large?: boolean }) {
  const src = imageFor(entry, variant);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <div className={`art-fallback ${large ? 'art-fallback-large' : ''}`} aria-label={`${entry.name} artwork unavailable`} data-testid={`artwork-fallback-${entry.name}`}>
        <span className="art-initial">{entry.name.slice(0, 1).toUpperCase()}</span>
        {large && variant === 'shiny' ? <span className="art-fallback-label">Shiny art not recorded</span> : null}
      </div>
    );
  }
  return <img className={`art-image ${large ? 'art-image-large' : ''}`} src={src} alt={`${entry.name} — ${variant} form`} onError={() => setFailed(true)} data-testid={`img-${variant}-${entry.name}`} />;
}

function Brand() {
  return (
    <Link href="/" className="brand-link" data-testid="link-home">
      <span className="brand-mark" aria-hidden="true"><span /></span>
      <span><strong>EVO<span>MON</span></strong><small>PERSONAL FIELD DEVICE / 001</small></span>
    </Link>
  );
}

function Header() {
  const [location] = useLocation();
  const { catalog } = useCatalog();
  const catalogActive = location === '/' || location.startsWith('/evomon/');
  const skillsActive = location === '/skills';
  return (
    <header className="site-header">
      <Brand />
      <nav className="header-nav" aria-label="Primary navigation">
        <Link href="/" className={`header-link ${catalogActive ? 'active' : ''}`} data-testid="button-catalog-nav">Catalog <span>{catalog.length || '—'}</span></Link>
        <Link href="/skills" className={`header-link ${skillsActive ? 'active' : ''}`} data-testid="link-skills-nav">Skills</Link>
        <a className="header-link" href={WIKI_URL} target="_blank" rel="noreferrer" data-testid="link-wiki-nav">Wiki source <ExternalLink size={13} /></a>
      </nav>
      <div className="header-status"><span className="status-light" /> LINK ESTABLISHED</div>
    </header>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell grain">
      <Header />
      {children}
      <footer className="site-footer">
        <span>EVOMON / FIELD GUIDE</span>
        <a href={WIKI_URL} target="_blank" rel="noreferrer" data-testid="link-wiki-footer">Source notes: Evomon Wiki <ExternalLink size={12} /></a>
        <span>ARCHIVE BUILD 01.01</span>
      </footer>
    </div>
  );
}

function ErrorNotice() {
  const { isError, catalog } = useCatalog();
  if (!isError) return null;
  return (
    <div className="catalog-notice" role="status" data-testid="status-catalog-error">
      <Info size={16} />
      <span>Live archive is unreachable. {catalog.length ? 'Showing the last available device record.' : 'No device record is cached yet.'}</span>
      <button type="button" onClick={() => window.location.reload()} data-testid="button-retry-catalog"><RotateCcw size={14} /> Retry</button>
    </div>
  );
}

function EmptyCatalog({ filtered = false, onReset }: { filtered?: boolean; onReset?: () => void }) {
  return (
    <section className="empty-state" data-testid="status-catalog-empty">
      <div className="empty-screen"><span className="empty-cross" /></div>
      <p className="eyebrow">{filtered ? 'SCAN COMPLETE / NO MATCH' : 'DEVICE READY / NO RECORDS'}</p>
      <h2 className="font-display">{filtered ? 'Adjust the scan.' : 'The archive is waiting.'}</h2>
      <p>{filtered ? 'No Evomon carries that combination of name, element, or stage. Clear a control and scan again.' : 'The catalog will appear here when the field notes are available.'}</p>
      {filtered && onReset && <button className="button button-secondary" onClick={onReset} type="button" data-testid="button-reset-filters"><X size={15} /> Clear controls</button>}
    </section>
  );
}

function SkeletonRoster() {
  return (
    <div className="roster-scroll skeleton-roster" aria-label="Loading catalog" data-testid="status-catalog-loading">
      {Array.from({ length: 9 }, (_, index) => <div className="skeleton-row" key={index}><div className="skeleton-dot skeleton-shimmer" /><div className="skeleton-line skeleton-shimmer" /><div className="skeleton-line short skeleton-shimmer" /></div>)}
    </div>
  );
}

function Filters({ query, setQuery, element, setElement, stage, setStage, variant, setVariant, elements, stages }: {
  query: string; setQuery: (value: string) => void; element: string; setElement: (value: string) => void;
  stage: string; setStage: (value: string) => void; variant: Variant; setVariant: (value: Variant) => void; elements: string[]; stages: string[];
}) {
  return (
    <section className="device-controls" aria-label="Catalog filters">
      <div className="control-search">
        <Search size={16} aria-hidden="true" />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name" aria-label="Search Evomon by name" data-testid="input-search-evomon" />
        {query && <button type="button" className="clear-search" onClick={() => setQuery('')} aria-label="Clear search" data-testid="button-clear-search"><X size={15} /></button>}
      </div>
      <label className="device-select"><span><Filter size={13} /> Element</span><select value={element} onChange={(event) => setElement(event.target.value)} aria-label="Filter by element" data-testid="select-element"><option value="all">All elements</option>{elements.map((item) => <option value={item} key={item}>{item}</option>)}</select><ChevronDown size={13} /></label>
      <label className="device-select"><span>Stage</span><select value={stage} onChange={(event) => setStage(event.target.value)} aria-label="Filter by evolution stage" data-testid="select-stage"><option value="all">Every stage</option>{stages.map((item) => <option value={item} key={item}>{item}</option>)}</select><ChevronDown size={13} /></label>
      <div className="variant-toggle" role="group" aria-label="Artwork variant">
        <button type="button" className={variant === 'normal' ? 'selected' : ''} onClick={() => setVariant('normal')} aria-pressed={variant === 'normal'} data-testid="button-view-normal">Normal</button>
        <button type="button" className={variant === 'shiny' ? 'selected shiny' : ''} onClick={() => setVariant('shiny')} aria-pressed={variant === 'shiny'} data-testid="button-view-shiny"><Sparkles size={13} /> Shiny</button>
      </div>
    </section>
  );
}

function ElementTags({ entry }: { entry: Evomon }) {
  const elements = elementsFor(entry);
  return <div className="row-elements">{elements.length ? elements.map((item) => <span key={item}>{item}</span>) : <span className="unrecorded">Unrecorded</span>}</div>;
}

function EvomonRow({ entry, index, variant }: { entry: Evomon; index: number; variant: Variant }) {
  const number = entry.dexNumber;
  const entryId = idFor(entry);
  return (
    <Link href={`/evomon/${encodeURIComponent(entryId)}`} className="roster-row" data-testid={`row-evomon-${entryId}`} aria-label={`Open ${entry.name}, entry ${number ?? index + 1}`}>
      <div className={`row-art ${variant === 'shiny' ? 'row-art-shiny' : ''}`}><Artwork entry={entry} variant={variant} /></div>
      <span className="row-number">{number !== undefined ? `#${String(number).padStart(3, '0')}` : `#${String(index + 1).padStart(3, '0')}`}</span>
      <span className="row-name">{entry.name}</span>
      <ElementTags entry={entry} />
      <span className="row-stage">{stageFor(entry)}</span>
      <ArrowRight className="row-arrow" size={15} aria-hidden="true" />
    </Link>
  );
}

function Device({ children, count, total }: { children: ReactNode; count: number; total: number }) {
  return (
    <section className="pokedex-device" aria-label="Evomon handheld Pokédex">
      <div className="device-topbar"><span className="device-screw" /><span className="device-label">EVOMON // SCANNER UNIT</span><span className="device-led" /><span className="device-battery">BAT 87%</span></div>
      <div className="device-bezel">
        <div className="screen-header"><div><span className="screen-kicker">FIELD SCAN / LIVE</span><strong>EVOMON CATALOG</strong></div><div className="screen-count"><b>{String(count).padStart(3, '0')}</b><span>/ {String(total).padStart(3, '0')} FOUND</span></div></div>
        {children}
      </div>
      <div className="device-footer"><span className="speaker-lines" /><span>SELECT AN ENTRY TO OPEN FULL READINGS</span><span className="device-model">EV-01</span></div>
    </section>
  );
}

function Home() {
  const { catalog, isLoading } = useCatalog();
  const [query, setQuery] = useState('');
  const [element, setElement] = useState('all');
  const [stage, setStage] = useState('all');
  const [variant, setVariant] = useState<Variant>('normal');
  useEffect(() => { document.title = 'Evomon — Handheld Field Guide'; }, []);
  const elements = useMemo(() => Array.from(new Set(catalog.flatMap(elementsFor))).sort(), [catalog]);
  const stages = useMemo(() => Array.from(new Set(catalog.map(stageFor))).sort(), [catalog]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return catalog.filter((entry) => entry.name.toLowerCase().includes(normalized) && (element === 'all' || elementsFor(entry).includes(element)) && (stage === 'all' || stageFor(entry) === stage));
  }, [catalog, query, element, stage]);
  const clearFilters = () => { setQuery(''); setElement('all'); setStage('all'); };
  const filtering = Boolean(query || element !== 'all' || stage !== 'all');
  return (
    <Shell>
      <main className="home-main">
        <section className="intro-strip fade-up">
          <div><p className="eyebrow">Personal field guide / vol. 01</p><h1 className="font-display">Scan the <em>unknown.</em></h1></div>
          <p className="intro-copy">A pocket-sized archive for curious trainers. Search the roster, compare forms, and open any specimen for its full field reading.</p>
          <div className="intro-index"><span>UNIT</span><b>001</b><span>ROSTER / {catalog.length || '—'}</span></div>
        </section>
        <ErrorNotice />
        <Device count={filtered.length} total={catalog.length}>
          <Filters {...{ query, setQuery, element, setElement, stage, setStage, variant, setVariant, elements, stages }} />
          <div className="roster-heading" aria-hidden="true"><span>ART</span><span>DEX NO.</span><span>SPECIMEN NAME</span><span>ELEMENT</span><span>STAGE</span><span /></div>
          {isLoading ? <SkeletonRoster /> : filtered.length ? <div className="roster-scroll" role="list" aria-label="Evomon roster" data-testid="roster-scroll">{filtered.map((entry, index) => <EvomonRow key={idFor(entry)} entry={entry} index={index} variant={variant} />)}</div> : <EmptyCatalog filtered={filtering} onReset={clearFilters} />}
          <div className="roster-footnote"><span>↑ ↓ Navigate roster</span><span>ENTER Open specimen</span><span>{variant === 'shiny' ? 'SHINY PLATES ACTIVE' : 'STANDARD PLATES ACTIVE'}</span></div>
        </Device>
        <div className="home-note"><span>CATALOG NOTE</span><p>Numbers follow the current Evomon Wiki archive. Blank fields are marked rather than guessed.</p><a href={WIKI_URL} target="_blank" rel="noreferrer" data-testid="link-catalog-source">Read source notes <ExternalLink size={12} /></a></div>
      </main>
    </Shell>
  );
}

const RADAR_STATS = [
  { key: 'hp', label: 'HP' },
  { key: 'spatk', label: 'SP. ATK' },
  { key: 'spdef', label: 'SP. DEF' },
  { key: 'speed', label: 'SPEED' },
  { key: 'def', label: 'DEFENSE' },
  { key: 'atk', label: 'ATTACK' },
] as const;

function radarPoint(cx: number, cy: number, radius: number, index: number, value = 1) {
  const angle = (-90 + index * 60) * (Math.PI / 180);
  return {
    x: cx + Math.cos(angle) * radius * value,
    y: cy + Math.sin(angle) * radius * value,
  };
}

function pointsForRadar(radius: number, value = 1) {
  return RADAR_STATS.map((_, index) => {
    const point = radarPoint(180, 151, radius, index, value);
    return `${point.x},${point.y}`;
  }).join(' ');
}

function StatRadar({ entry, variant }: { entry: Evomon; variant: Variant }) {
  const stats = statsFor(entry, variant);
  if (!Object.keys(stats).length) return <div className="missing-panel" data-testid={`status-stats-missing-${variant}`}>Base stats for the {variant} plate are not recorded in the current wiki notes.</div>;
  const max = Math.max(100, ...RADAR_STATS.map(({ key }) => stats[key] ?? 0));
  const values = RADAR_STATS.map(({ key }) => Math.min((stats[key] ?? 0) / max, 1));
  return (
    <div className="radar-readout" data-testid={`table-stats-${variant}`}>
      <svg className="stat-radar" viewBox="0 0 360 330" role="img" aria-label={`${entry.name} ${variant} base stats radar`}>
        <title>{entry.name} {variant} base stats</title>
        {[1, .75, .5, .25].map((scale) => <polygon className="radar-grid" points={pointsForRadar(105, scale)} key={scale} />)}
        {RADAR_STATS.map((stat, index) => {
          const spoke = radarPoint(180, 151, 105, index);
          return <line className="radar-spoke" key={stat.key} x1="180" y1="151" x2={spoke.x} y2={spoke.y} />;
        })}
        <polygon className={`radar-value radar-value-${variant}`} points={values.map((value, index) => { const point = radarPoint(180, 151, 105, index, value); return `${point.x},${point.y}`; }).join(' ')} />
        {RADAR_STATS.map((stat, index) => {
          const label = radarPoint(180, 151, 137, index);
          const value = stats[stat.key] ?? 0;
          return (
            <text className="radar-label" x={label.x} y={label.y} textAnchor="middle" key={stat.key}>
              <tspan>{stat.label}</tspan>
              <tspan className="radar-number" x={label.x} dy="16">{value}</tspan>
            </text>
          );
        })}
        {values.map((value, index) => {
          const point = radarPoint(180, 151, 105, index, value);
          return <circle className={`radar-dot radar-dot-${variant}`} cx={point.x} cy={point.y} r="4.5" key={RADAR_STATS[index].key} />;
        })}
      </svg>
      {variant === 'shiny' && !entry.shinyStatsRecorded ? <p className="stats-note">Separate shiny stats are not listed by the wiki; normal base stats shown.</p> : null}
    </div>
  );
}

function DetailField({ label, value, testId }: { label: string; value?: string; testId: string }) {
  return <div className="detail-field"><span className="field-label">{label}</span><p data-testid={testId}>{value || missing}</p></div>;
}

function MoveCard({ move }: { move: EvomonMove }) {
  const level = move.unlockLevel !== null ? `Lv ${move.unlockLevel}` : 'Level unrecorded';
  return (
    <article className="move-card" data-testid={`move-${move.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`}>
      <div className="move-card-head">
        <div>
          <span className="move-level">{move.slot === 'ultimate' ? 'ULT · ' : ''}{level}</span>
          <h3 className="font-display">{move.name}</h3>
        </div>
        <span className="move-element">{move.element}</span>
      </div>
      <div className="move-tags" aria-label={`${move.name} classifications`}>
        {move.tags.map((tag) => <span className={`move-tag move-tag-${tag.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`} key={tag}>{tag}</span>)}
      </div>
      <p className="move-description">{move.description}</p>
      <div className="move-meta">
        <span>Power <b>{move.power ?? '—'}</b></span>
        <span>Uses <b>{move.uses ?? '—'}</b></span>
        {move.obtained ? <span className="move-obtained">{move.obtained}</span> : null}
      </div>
    </article>
  );
}

function Moveset({ moves }: { moves?: EvomonMove[] }) {
  const recordedMoves = Array.isArray(moves) ? moves : [];
  return (
    <section className="moves-section" data-testid="section-moveset">
      <div className="moves-heading">
        <div className="section-kicker"><span>03</span><div><h2 className="font-display">Moveset</h2><p className="section-caption">{recordedMoves.length} documented moves · sorted by unlock level</p></div></div>
        <a href={MOVES_URL} target="_blank" rel="noreferrer" data-testid="link-moves-source">Moves source <ExternalLink size={12} /></a>
      </div>
      {recordedMoves.length
        ? <div className="moves-grid">{recordedMoves.map((move) => <MoveCard move={move} key={`${move.slot}-${move.unlockLevel}-${move.name}`} />)}</div>
        : <div className="missing-panel">No moves or unlock levels are recorded for this Evomon on the current Wiki Moves page.</div>}
    </section>
  );
}

const SKILL_ATTRIBUTES: MoveTag[] = ['Physical', 'Sp. Atk', 'Support', 'Priority', 'Status condition', 'Weather', 'AoE', 'Single target'];

type SkillIndexEntry = {
  key: string;
  move: EvomonMove;
  displayName: string;
  ultimateRange?: string;
  learners: Array<{ entry: Evomon; unlockLevel: number | null; slot: string; ultimateRange?: string }>;
};

function skillIndexFor(catalog: Evomon[]): SkillIndexEntry[] {
  const byName = new Map<string, SkillIndexEntry>();
  const entriesByName = new Map(catalog.map((entry) => [entry.name, entry] as const));
  for (const entry of catalog) {
    const baseName = entry.evolutionLine?.[0];
    const baseEntry = (baseName ? entriesByName.get(baseName) : undefined) ?? entry;
    for (const move of entry.moves ?? []) {
      const ultimateMatch = move.slot === 'ultimate' ? move.name.match(/^(.*) ([1-3])$/) : null;
      const displayName = ultimateMatch?.[1] || move.name;
      const key = ultimateMatch ? `ultimate:${displayName}` : `move:${move.name}`;
      const current = byName.get(key) ?? {
        key,
        move,
        displayName,
        ultimateRange: ultimateMatch ? '1 → 3' : undefined,
        learners: [],
      };
      const learner = { entry: baseEntry, unlockLevel: move.unlockLevel, slot: move.slot, ultimateRange: ultimateMatch ? '1 → 3' : undefined };
      if (!current.learners.some(({ entry: learnerEntry }) => idFor(learnerEntry) === idFor(baseEntry))) current.learners.push(learner);
      byName.set(key, current);
    }
  }
  return [...byName.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function SkillLearner({ learner }: { learner: SkillIndexEntry['learners'][number] }) {
  return (
    <Link href={`/evomon/${encodeURIComponent(idFor(learner.entry))}`} className="skill-learner" data-testid={`skill-learner-${idFor(learner.entry)}`}>
      <span className="skill-learner-name">{learner.entry.name}</span>
      <span className="skill-learner-level">{learner.ultimateRange ? `ULT · ${learner.ultimateRange}` : `${learner.slot === 'ultimate' ? 'ULT · ' : ''}Lv ${learner.unlockLevel ?? '—'}`}</span>
      <ArrowRight size={13} aria-hidden="true" />
    </Link>
  );
}

function Skills() {
  const { catalog, isLoading } = useCatalog();
  const [query, setQuery] = useState('');
  const [attribute, setAttribute] = useState<MoveTag | 'all'>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const skills = useMemo(() => skillIndexFor(catalog), [catalog]);
  const attributeCounts = useMemo(() => Object.fromEntries(SKILL_ATTRIBUTES.map((tag) => [tag, skills.filter(({ move }) => move.tags.includes(tag)).length])), [skills]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return skills.filter(({ displayName, move }) => {
      const searchableText = [displayName, move.name, move.element, move.description, move.obtained ?? '', ...move.tags].join(' ').toLowerCase();
      return (!normalized || searchableText.includes(normalized)) && (attribute === 'all' || move.tags.includes(attribute));
    });
  }, [attribute, query, skills]);
  const selected = filtered.find(({ key }) => key === selectedKey) ?? filtered[0];

  useEffect(() => {
    if (selected && selected.key !== selectedKey) setSelectedKey(selected.key);
    if (!selected) setSelectedKey(null);
  }, [selected, selectedKey]);

  return (
    <Shell>
      <main className="skills-main">
        <section className="skills-intro fade-up">
          <div>
            <p className="eyebrow">Skill archive / field index</p>
            <h1 className="font-display">Find the <em>right move.</em></h1>
          </div>
          <p className="intro-copy">Filter by what a skill does, then open its record to see the base Mon for each evolution line that learns it.</p>
          <div className="intro-index"><span>SKILLS</span><b>{skills.length || '—'}</b><span>{catalog.length || '—'} MON</span></div>
        </section>
        <ErrorNotice />
        <section className="skill-device" aria-label="Evomon skill archive">
          <div className="skill-device-top"><span>EVOMON // SKILL INDEX</span><span className="device-led" /><span>{skills.length} DOCUMENTED SKILLS</span></div>
          <div className="skill-screen">
            <div className="skill-toolbar">
              <div className="control-search">
                <Search size={16} aria-hidden="true" />
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search skill, effect, or element" aria-label="Search skills, effects, or elements" data-testid="input-search-skills" />
                {query && <button type="button" className="clear-search" onClick={() => setQuery('')} aria-label="Clear skill search" data-testid="button-clear-skill-search"><X size={15} /></button>}
              </div>
              <div className="skill-attributes" role="group" aria-label="Filter by skill attribute">
                <button type="button" className={attribute === 'all' ? 'selected' : ''} onClick={() => setAttribute('all')} aria-pressed={attribute === 'all'} data-testid="button-skill-attribute-all">All <span>{skills.length}</span></button>
                {SKILL_ATTRIBUTES.map((tag) => <button type="button" className={attribute === tag ? 'selected' : ''} onClick={() => setAttribute(tag)} aria-pressed={attribute === tag} key={tag} data-testid={`button-skill-attribute-${tag.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`}>{tag} <span>{attributeCounts[tag] ?? 0}</span></button>)}
              </div>
            </div>
            {isLoading
              ? <div className="skill-loading" data-testid="status-skills-loading">Loading skill records…</div>
              : filtered.length
                ? <div className="skill-browser">
                  <div className="skill-results" role="listbox" aria-label="Skill results" data-testid="skill-results">
                    <div className="skill-results-heading"><span>{filtered.length} MATCHES</span><span>SELECT A RECORD</span></div>
                    {filtered.map(({ key, move, displayName, ultimateRange, learners }) => <button type="button" role="option" aria-selected={selected?.key === key} className={`skill-result ${selected?.key === key ? 'selected' : ''}`} onClick={() => setSelectedKey(key)} key={key} data-testid={`skill-result-${displayName.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`}>
                      <span className="skill-result-name">{displayName}{ultimateRange ? ` · Ultimate ${ultimateRange}` : ''}</span>
                      <span className="skill-result-meta">{move.element} · {learners.length} Mon</span>
                      <ArrowRight size={14} aria-hidden="true" />
                    </button>)}
                  </div>
                  {selected && <article className="skill-detail" data-testid="skill-detail">
                    <div className="skill-detail-top"><div><span className="move-level">{selected.ultimateRange ? `ULTIMATE ${selected.ultimateRange}` : selected.move.slot === 'ultimate' ? 'ULTIMATE RECORD' : 'LEARNABLE RECORD'}</span><h2 className="font-display">{selected.displayName}</h2></div><span className="move-element">{selected.move.element}</span></div>
                    <div className="move-tags">{selected.move.tags.map((tag) => <span className={`move-tag move-tag-${tag.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`} key={tag}>{tag}</span>)}</div>
                    <p className="skill-detail-description">{selected.move.description}</p>
                    <div className="skill-detail-stats"><span>Power <b>{selected.move.power ?? '—'}</b></span><span>Uses <b>{selected.move.uses ?? '—'}</b></span><span>{selected.move.obtained ?? 'Source unrecorded'}</span></div>
                    <div className="skill-learners-heading"><span>Base Mon by evolution line</span><b>{selected.learners.length} Mon</b></div>
                    <div className="skill-learners">{selected.learners.map((learner) => <SkillLearner learner={learner} key={idFor(learner.entry)} />)}</div>
                  </article>}
                </div>
                : <div className="skill-empty" data-testid="status-skills-empty"><span className="eyebrow">SCAN COMPLETE / NO MATCH</span><h2 className="font-display">Adjust the filter.</h2><p>No documented skill matches that search and attribute combination.</p></div>}
          </div>
          <div className="skill-device-footer"><span>ATTRIBUTE FILTERS SHOW DOCUMENTED SKILLS ONLY</span><a href={MOVES_URL} target="_blank" rel="noreferrer" data-testid="link-skills-source">Open Wiki moves <ExternalLink size={12} /></a></div>
        </section>
      </main>
    </Shell>
  );
}

function Detail() {
  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const { catalog } = useCatalog();
  const [variant, setVariant] = useState<Variant>('normal');
  const entryIndex = catalog.findIndex((entry) => idFor(entry) === decodeURIComponent(params.id ?? ''));
  const entry = entryIndex >= 0 ? catalog[entryIndex] : undefined;
  useEffect(() => { document.title = entry ? `${entry.name} — Evomon Field Guide` : 'Entry not found — Evomon'; }, [entry]);
  if (!entry) return <Shell><main className="detail-main"><EmptyCatalog /></main></Shell>;
  const elements = elementsFor(entry);
  const line = Array.isArray(entry.evolutionLine) ? entry.evolutionLine : [];
  const previous = catalog[entryIndex - 1];
  const next = catalog[entryIndex + 1];
  return (
    <Shell>
      <main className="detail-main">
        <div className="detail-top"><button type="button" className="back-link" onClick={() => setLocation('/')} data-testid="button-back-catalog"><ArrowLeft size={16} /> Back to roster</button><span className="detail-position">{String(entryIndex + 1).padStart(3, '0')} / {String(catalog.length).padStart(3, '0')}</span></div>
        <section className="detail-device">
          <div className="detail-device-top"><span>EVOMON // SPECIMEN READOUT</span><span className="device-led" /> <span>{variant === 'shiny' ? 'SHINY PLATE' : 'STANDARD PLATE'}</span></div>
          <div className="detail-hero">
            <div className="detail-art-wrap"><Artwork entry={entry} variant={variant} large /><div className="detail-art-caption"><span>{elements.length ? elements.join(' / ') : 'ELEMENT UNRECORDED'}</span><span>EV-{entry.dexNumber !== undefined ? String(entry.dexNumber).padStart(3, '0') : '???'}</span></div></div>
            <div className="detail-title"><p className="eyebrow">{stageFor(entry)} <span>·</span> {entry.eventStatus || 'Event status unrecorded'}</p><h1 className="font-display">{entry.name}</h1><p className="detail-subline">Archive specimen {entry.dexNumber !== undefined ? String(entry.dexNumber).padStart(3, '0') : 'unrecorded'}<span className="title-dot" />{entry.catchLocation || 'Location unrecorded'}</p><div className="detail-variant-toggle"><button type="button" className={variant === 'normal' ? 'selected' : ''} onClick={() => setVariant('normal')} aria-pressed={variant === 'normal'} data-testid="button-detail-normal">Normal form</button><button type="button" className={variant === 'shiny' ? 'selected shiny' : ''} onClick={() => setVariant('shiny')} aria-pressed={variant === 'shiny'} data-testid="button-detail-shiny"><Sparkles size={14} /> Shiny form</button></div></div>
          </div>
          <section className="detail-content">
            <div className="stats-section"><div className="section-kicker"><span>01</span><div><h2 className="font-display">Base readings</h2><p className="section-caption">{variant === 'shiny' ? 'Shiny plate selected' : 'Standard plate selected'} · values shown on radar</p></div></div><StatRadar entry={entry} variant={variant} /></div>
            <aside className="journal-sidebar"><div className="trait-card"><div className="trait-heading"><Sparkles size={17} /><span>Legendary trait</span></div><h2 className="font-display" data-testid="text-legendary-trait">{entry.legendaryTrait || missing}</h2><p data-testid="text-legendary-effect">{entry.legendaryTraitEffect || missing}</p></div><div className="details-list"><DetailField label="Catch location" value={entry.catchLocation} testId="text-catch-location" /><DetailField label="Event status" value={entry.eventStatus} testId="text-event-status" /></div></aside>
          </section>
          <section className="evolution-section"><div className="section-kicker"><span>02</span><h2 className="font-display">Evolution line</h2></div>{line.length ? <div className="evolution-line">{line.map((item, index) => <div className={`evolution-node ${item === entry.name ? 'current' : ''}`} key={`${item}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><b>{item}</b>{index < line.length - 1 && <ArrowRight size={15} />}</div>)}</div> : <div className="missing-panel">Evolution line not recorded in the current wiki notes.</div>}</section>
          <Moveset moves={entry.moves} />
        </section>
        <div className="detail-nav"><div>{previous && <Link href={`/evomon/${encodeURIComponent(idFor(previous))}`} className="pager-link" data-testid="link-previous-entry"><ArrowLeft size={15} /><span>Previous specimen<b>{previous.name}</b></span></Link>}</div><div>{next && <Link href={`/evomon/${encodeURIComponent(idFor(next))}`} className="pager-link next" data-testid="link-next-entry"><span>Next specimen<b>{next.name}</b></span><ArrowRight size={15} /></Link>}</div></div>
        <p className="source-note">Field notes sourced from <a href={entry.sourceUrl || WIKI_URL} target="_blank" rel="noreferrer" data-testid="link-wiki-source">the Evomon Wiki <ExternalLink size={12} /></a>. Unrecorded details are left blank rather than guessed.</p>
      </main>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route path="/skills" component={Skills} /><Route path="/evomon/:id" component={Detail} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function CatalogLoader({ children }: { children: ReactNode }) {
  const catalogQuery = useGetEvomonCatalog();
  const catalog = catalogQuery.data?.mons ?? evomonData;
  return <CatalogContext.Provider value={{ catalog, isLoading: catalogQuery.isLoading, isError: catalogQuery.isError }}>{children}</CatalogContext.Provider>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><CatalogLoader><Router /></CatalogLoader><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;