import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, ExternalLink, Filter, Leaf, MapPin, Search, Sparkles, X } from 'lucide-react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import { type Evomon, evomonData } from '@/data/evomonData';
import { useGetEvomonCatalog } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const WIKI_URL = 'https://www.evomon.wiki/wiki';
type Variant = 'normal' | 'shiny';
const CatalogContext = createContext({ catalog: evomonData, isLoading: true, isError: false });

function useCatalog() {
  return useContext(CatalogContext);
}

const asList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return typeof value === 'string' && value.trim() ? [value] : [];
};

const numberFor = (entry: Evomon) => entry.dexNumber;
const idFor = (entry: Evomon) => entry.id ?? entry.name.toLowerCase().replaceAll(/\s+/g, '-');
const elementsFor = (entry: Evomon) => asList(entry.element);
const stageFor = (entry: Evomon) => entry.stage ?? 'Unclassified';
const imageFor = (entry: Evomon, variant: Variant) => {
  if (variant === 'shiny') return entry.shinyImage;
  return entry.image;
};
const statsFor = (entry: Evomon, variant: Variant): Record<string, number> => {
  return variant === 'shiny' ? (entry.shinyBaseStats ?? entry.baseStats ?? {}) : (entry.baseStats ?? {});
};
const missing = 'Not recorded in current wiki notes';

function Artwork({ entry, variant, large = false }: { entry: Evomon; variant: Variant; large?: boolean }) {
  const src = imageFor(entry, variant);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const number = numberFor(entry);
  if (!src || failed) {
    return (
      <div className={`art-fallback ${large ? 'art-fallback-large' : ''}`} aria-label={`${entry.name} artwork unavailable`} data-testid={`artwork-fallback-${entry.name}`}>
        <span className="art-orbit" />
        <span className="art-initial">{entry.name.slice(0, 1).toUpperCase()}</span>
        {number !== undefined && <span className="art-number">#{String(number).padStart(3, '0')}</span>}
      </div>
    );
  }
  return <img className={`art-image ${large ? 'art-image-large' : ''}`} src={src} alt={`${entry.name} — ${variant} form`} onError={() => setFailed(true)} data-testid={`img-${variant}-${entry.name}`} />;
}

function Brand() {
  return (
    <Link href="/" className="brand-link" data-testid="link-home">
      <span className="brand-mark" aria-hidden="true"><span /></span>
      <span><strong>EVO<span>MON</span></strong><small>FIELD GUIDE / 001</small></span>
    </Link>
  );
}

function Header() {
  const [, setLocation] = useLocation();
  const { catalog } = useCatalog();
  return (
    <header className="site-header">
      <Brand />
      <nav className="header-nav" aria-label="Primary navigation">
        <button type="button" className="header-link active" onClick={() => setLocation('/')} data-testid="button-catalog-nav">Catalog <span>{catalog.length || '—'}</span></button>
        <a className="header-link" href={WIKI_URL} target="_blank" rel="noreferrer" data-testid="link-wiki-nav">Wiki source <ExternalLink size={13} /></a>
      </nav>
      <div className="header-stamp">ARCHIVE<br /><b>LIVE</b></div>
    </header>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="app-shell grain"><Header />{children}<footer className="site-footer"><span>EVOMON / FIELD GUIDE</span><a href={WIKI_URL} target="_blank" rel="noreferrer" data-testid="link-wiki-footer">Source notes: Evomon Wiki <ExternalLink size={12} /></a><span>For curious trainers</span></footer></div>;
}

function EmptyCatalog({ filtered = false, onReset }: { filtered?: boolean; onReset?: () => void }) {
  return (
    <section className="empty-state paper-grid" data-testid="status-catalog-empty">
      <div className="empty-seal"><Leaf size={26} /></div>
      <p className="eyebrow">{filtered ? 'NO MATCHES IN THE ARCHIVE' : 'FIELD NOTES PENDING'}</p>
      <h2 className="font-display">{filtered ? 'Try a gentler search.' : 'The specimen cabinet is waiting.'}</h2>
      <p>{filtered ? 'No Evomon carries that combination of name, element, or stage. Clear a filter and continue the hunt.' : 'The local catalog will appear here when the field notes are added. Missing wiki information will remain clearly marked.'}</p>
      {filtered && onReset && <button className="button button-secondary" onClick={onReset} type="button" data-testid="button-reset-filters"><X size={15} /> Clear all filters</button>}
    </section>
  );
}

function SkeletonGrid() {
  return <div className="catalog-grid" aria-label="Loading catalog" data-testid="status-catalog-loading">{Array.from({ length: 8 }, (_, index) => <div className="skeleton-card" key={index}><div className="skeleton-art skeleton-shimmer" /><div className="skeleton-line skeleton-shimmer" /><div className="skeleton-line short skeleton-shimmer" /></div>)}</div>;
}

function Filters({ query, setQuery, element, setElement, stage, setStage, variant, setVariant, elements, stages }: {
  query: string; setQuery: (value: string) => void; element: string; setElement: (value: string) => void;
  stage: string; setStage: (value: string) => void; variant: Variant; setVariant: (value: Variant) => void; elements: string[]; stages: string[];
}) {
  return (
    <section className="filter-bar fade-up fade-up-delay-2" aria-label="Catalog filters">
      <div className="search-wrap"><Search size={17} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search field notes…" aria-label="Search Evomon by name" data-testid="input-search-evomon" />{query && <button type="button" className="clear-search" onClick={() => setQuery('')} aria-label="Clear search" data-testid="button-clear-search"><X size={15} /></button>}</div>
      <div className="filter-select"><Filter size={14} /><select value={element} onChange={(event) => setElement(event.target.value)} aria-label="Filter by element" data-testid="select-element"><option value="all">All elements</option>{elements.map((item) => <option value={item} key={item}>{item}</option>)}</select><ChevronDown size={14} /></div>
      <div className="filter-select"><select value={stage} onChange={(event) => setStage(event.target.value)} aria-label="Filter by evolution stage" data-testid="select-stage"><option value="all">Every stage</option>{stages.map((item) => <option value={item} key={item}>{item}</option>)}</select><ChevronDown size={14} /></div>
      <div className="variant-toggle" role="group" aria-label="Artwork variant">
        <button type="button" className={variant === 'normal' ? 'selected' : ''} onClick={() => setVariant('normal')} aria-pressed={variant === 'normal'} data-testid="button-view-normal">Normal</button>
        <button type="button" className={variant === 'shiny' ? 'selected shiny' : ''} onClick={() => setVariant('shiny')} aria-pressed={variant === 'shiny'} data-testid="button-view-shiny"><Sparkles size={13} /> Shiny</button>
      </div>
    </section>
  );
}

function EvomonCard({ entry, index, variant }: { entry: Evomon; index: number; variant: Variant }) {
  const number = numberFor(entry);
  const entryId = idFor(entry);
  const elements = elementsFor(entry);
  return (
    <Link href={`/evomon/${encodeURIComponent(entryId)}`} className="evomon-card fade-up" style={{ animationDelay: `${Math.min(index * 35, 350)}ms` }} data-testid={`card-evomon-${entryId}`}>
      <div className={`card-art ${variant === 'shiny' ? 'card-art-shiny' : ''}`}><Artwork entry={entry} variant={variant} /><span className="card-index">{number !== undefined ? `#${String(number).padStart(3, '0')}` : `NO. ${String(index + 1).padStart(3, '0')}`}</span><span className="card-stage">{stageFor(entry)}</span></div>
      <div className="card-copy"><div className="card-title-row"><h3>{entry.name}</h3><ArrowRight size={16} /></div><div className="card-meta">{elements.length ? elements.map((item) => <span key={item}>{item}</span>) : <span>Element unrecorded</span>}<i /> <span>{variant === 'shiny' ? 'Shiny plate' : 'Standard plate'}</span></div></div>
    </Link>
  );
}

function Home() {
  const { catalog, isLoading } = useCatalog();
  const [query, setQuery] = useState('');
  const [element, setElement] = useState('all');
  const [stage, setStage] = useState('all');
  const [variant, setVariant] = useState<Variant>('normal');
  const [booting, setBooting] = useState(true);
  useEffect(() => { const timer = window.setTimeout(() => setBooting(false), 260); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { document.title = 'Evomon — Field Guide'; }, []);
  const elements = useMemo(() => Array.from(new Set(catalog.flatMap(elementsFor))).sort(), [catalog]);
  const stages = useMemo(() => Array.from(new Set(catalog.map(stageFor))).sort(), [catalog]);
  const filtered = useMemo(() => catalog.filter((entry) => {
    const matchesQuery = entry.name.toLowerCase().includes(query.toLowerCase().trim());
    const matchesElement = element === 'all' || elementsFor(entry).includes(element);
    const matchesStage = stage === 'all' || stageFor(entry) === stage;
    return matchesQuery && matchesElement && matchesStage;
  }), [catalog, query, element, stage]);
  const clearFilters = () => { setQuery(''); setElement('all'); setStage('all'); };
  return (
    <Shell>
      <main className="home-main">
        <section className="hero fade-up">
          <div className="hero-copy"><p className="eyebrow">A collector’s field guide <span>—</span> vol. 01</p><h1 className="font-display">Know the <em>unknown.</em></h1><p className="hero-dek">A living archive of every creature across the Evomon world. Compare forms, trace evolution, and keep your eyes open for the rare ones.</p></div>
          <div className="hero-record" aria-label="Catalog summary"><span className="record-label">CURRENT RECORD</span><strong>{String(catalog.length).padStart(3, '0')}</strong><span>known specimens</span><div className="record-line" /><small>Updated from the Evomon Wiki</small></div>
          <div className="hero-index">01<br /><span>/</span><br />∞</div>
        </section>
        <div className="catalog-heading fade-up fade-up-delay-1"><div><p className="eyebrow">The specimen cabinet</p><h2 className="font-display">Browse the archive</h2></div><p className="catalog-count" data-testid="text-results-count">{filtered.length} <span>of {catalog.length} entries</span></p></div>
        <Filters {...{ query, setQuery, element, setElement, stage, setStage, variant, setVariant, elements, stages }} />
        <section className="catalog-area">
          {booting || isLoading ? <SkeletonGrid /> : filtered.length ? <div className="catalog-grid">{filtered.map((entry, index) => <EvomonCard key={idFor(entry)} entry={entry} index={index} variant={variant} />)}</div> : <EmptyCatalog filtered={Boolean(query || element !== 'all' || stage !== 'all')} onReset={clearFilters} />}
        </section>
      </main>
    </Shell>
  );
}

function StatTable({ entry, variant }: { entry: Evomon; variant: Variant }) {
  const stats = statsFor(entry, variant);
  const allStats = Object.entries(stats);
  if (!allStats.length) return <div className="missing-panel" data-testid={`status-stats-missing-${variant}`}>Base stats for the {variant} plate are not recorded in the current wiki notes.</div>;
  const max = Math.max(...allStats.map(([, value]) => value), 1);
  return <><div className="stat-table" data-testid={`table-stats-${variant}`}>{allStats.map(([label, value]) => <div className="stat-row" key={label}><span>{label}</span><div className="stat-track"><i style={{ transform: `scaleX(${Math.min(value / max, 1)})` }} /></div><b>{value}</b></div>)}</div>{variant === 'shiny' && !entry.shinyStatsRecorded ? <p className="stats-note">Separate shiny stats are not listed by the wiki; normal base stats shown.</p> : null}</>;
}

function DetailField({ label, value, testId }: { label: string; value?: string; testId: string }) {
  return <div className="detail-field"><span className="field-label">{label}</span><p data-testid={testId}>{value || missing}</p></div>;
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
  const number = numberFor(entry);
  const previous = catalog[entryIndex - 1];
  const next = catalog[entryIndex + 1];
  const trait = entry.legendaryTrait;
  const effect = entry.legendaryTraitEffect;
  return (
    <Shell>
      <main className="detail-main">
        <div className="detail-top"><button type="button" className="back-link" onClick={() => setLocation('/')} data-testid="button-back-catalog"><ArrowLeft size={16} /> Back to cabinet</button><span className="detail-position">{entryIndex + 1} / {catalog.length}</span></div>
        <section className="detail-hero">
          <div className="detail-art-wrap"><Artwork entry={entry} variant={variant} large /><div className="detail-art-caption"><span>{variant === 'shiny' ? 'SHINY PLATE' : 'STANDARD PLATE'}</span><span>{number !== undefined ? `EV-${String(number).padStart(3, '0')}` : 'EV-MISSING'}</span></div></div>
          <div className="detail-title"><p className="eyebrow">{elements.length ? elements.join(' / ') : 'Element unrecorded'} <span>·</span> {stageFor(entry)}</p><h1 className="font-display">{entry.name}</h1><p className="detail-subline">{number !== undefined ? `Archive specimen ${String(number).padStart(3, '0')}` : 'Archive number unrecorded'}<span className="title-dot" />{entry.eventStatus || 'Event status unrecorded'}</p><div className="detail-variant-toggle"><button type="button" className={variant === 'normal' ? 'selected' : ''} onClick={() => setVariant('normal')} aria-pressed={variant === 'normal'} data-testid="button-detail-normal">Normal form</button><button type="button" className={variant === 'shiny' ? 'selected shiny' : ''} onClick={() => setVariant('shiny')} aria-pressed={variant === 'shiny'} data-testid="button-detail-shiny"><Sparkles size={14} /> Shiny form</button></div><div className="title-rule" /></div>
        </section>
        <section className="detail-content">
          <div className="stats-section"><div className="section-kicker"><span>01</span><h2 className="font-display">Base readings</h2></div><div className="stat-columns"><div><h3>Normal plate</h3><StatTable entry={entry} variant="normal" /></div><div><h3>Shiny plate</h3><StatTable entry={entry} variant="shiny" /></div></div></div>
          <aside className="journal-sidebar"><div className="trait-card"><div className="trait-heading"><Sparkles size={17} /><span>Legendary trait</span></div><h2 className="font-display" data-testid="text-legendary-trait">{trait || missing}</h2><p data-testid="text-legendary-effect">{effect || missing}</p></div><div className="details-list"><DetailField label="Catch location" value={entry.catchLocation} testId="text-catch-location" /><DetailField label="Event status" value={entry.eventStatus} testId="text-event-status" /></div></aside>
        </section>
        <section className="evolution-section"><div className="section-kicker"><span>02</span><h2 className="font-display">Evolution line</h2></div>{line.length ? <div className="evolution-line">{line.map((item, index) => <div className={`evolution-node ${item === entry.name ? 'current' : ''}`} key={`${item}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><b>{item}</b>{index < line.length - 1 && <ArrowRight size={15} />}</div>)}</div> : <div className="missing-panel">Evolution line not recorded in the current wiki notes.</div>}</section>
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
  return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route path="/evomon/:id" component={Detail} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><CatalogLoader><Router /></CatalogLoader><Toaster /></TooltipProvider></QueryClientProvider>;
}

function CatalogLoader({ children }: { children: ReactNode }) {
  const catalogQuery = useGetEvomonCatalog();
  const catalog = catalogQuery.data?.mons ?? evomonData;
  return <CatalogContext.Provider value={{ catalog, isLoading: catalogQuery.isLoading, isError: catalogQuery.isError }}>{children}</CatalogContext.Provider>;
}

export default App;