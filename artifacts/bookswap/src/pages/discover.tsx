import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, BookOpen, LocateFixed, MapPin, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/notice';
import { useAuth } from '@/lib/auth-context';
import { isSupabaseConfigured } from '@/lib/supabase';
import { approximateAreaLabel, isPrivateContactText, publicReaderName } from '@/lib/public-reader';
import { getMyApproximateLocation, getPublicBookPhotoUrl, listDiscoverBooks, saveApproximateBrowserLocation, type DiscoverFilters, type NearbyBook } from '@/features/discover/api';
import type { BookCondition } from '@/features/books/api';

const defaultFilters: DiscoverFilters = { query: '', genre: '', condition: '', language: '', area: '', distanceKm: null, latitude: null, longitude: null };
const conditionNames: Record<BookCondition, string> = { like_new: 'Like new', good: 'Good', fair: 'Fair', worn: 'Well loved' };
const conditions: BookCondition[] = ['like_new', 'good', 'fair', 'worn'];

export default function DiscoverPage() {
  const { user } = useAuth();
  const [draft, setDraft] = useState<DiscoverFilters>(defaultFilters);
  const [applied, setApplied] = useState<DiscoverFilters>(defaultFilters);
  const [books, setBooks] = useState<NearbyBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [savedLocation, setSavedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locationMessage, setLocationMessage] = useState('');
  const hasFilters = useMemo(() => Boolean(applied.query || applied.genre || applied.condition || applied.language || applied.area || applied.distanceKm), [applied]);
  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    setError('');
    void listDiscoverBooks(applied).then((results) => {
      if (!active) return;
      const available = results.filter((book) => book.status === 'available');
      setBooks(available.slice().sort((left, right) => {
        if (left.distance_km === null) return right.distance_km === null ? 0 : 1;
        if (right.distance_km === null) return -1;
        return left.distance_km - right.distance_km;
      }));
    }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : 'Nearby books could not be loaded.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applied]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) { setSavedLocation(null); return; }
    let active = true;
    void getMyApproximateLocation().then((location) => {
      if (!active) return;
      if (location.latitude !== null && location.longitude !== null) {
        setSavedLocation({ latitude: location.latitude, longitude: location.longitude });
        setDraft((current) => ({ ...current, area: current.area || location.area }));
      }
    }).catch((caught: unknown) => {
      if (active) setLocationError(caught instanceof Error ? caught.message : 'Your saved area could not be loaded.');
    });
    return () => { active = false; };
  }, [user?.id]);

  const updateDraft = <K extends keyof DiscoverFilters>(key: K, value: DiscoverFilters[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const applyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApplied({ ...draft, query: draft.query.trim(), latitude: savedLocation?.latitude ?? null, longitude: savedLocation?.longitude ?? null });
  };
  const clearFilters = () => {
    const empty = { ...defaultFilters, latitude: savedLocation?.latitude ?? null, longitude: savedLocation?.longitude ?? null };
    setDraft(empty);
    setApplied(empty);
  };
  const saveLocation = async () => {
    setLocationError('');
    setLocationMessage('');
    setLocationLoading(true);
    try {
      const coordinates = await saveApproximateBrowserLocation();
      setSavedLocation(coordinates);
      setDraft((current) => ({ ...current, distanceKm: 20, latitude: coordinates.latitude, longitude: coordinates.longitude }));
      setApplied((current) => ({ ...current, distanceKm: 20, latitude: coordinates.latitude, longitude: coordinates.longitude }));
      setLocationMessage('Your approximate location is saved. BookSwap stores a rounded area, not exact coordinates.');
    } catch (caught) {
      setLocationError(caught instanceof Error ? caught.message : 'Your approximate location could not be saved.');
    } finally { setLocationLoading(false); }
  };
  const retry = () => {
    setRefreshing(true);
    setError('');
    void listDiscoverBooks(applied).then((results) => {
      const available = results.filter((book) => book.status === 'available');
      setBooks(available.slice().sort((left, right) => left.distance_km === null ? (right.distance_km === null ? 0 : 1) : right.distance_km === null ? -1 : left.distance_km - right.distance_km));
    }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Nearby books could not be loaded.'))
      .finally(() => setRefreshing(false));
  };

  return <div className="page-enter space-y-7">
    <section className="relative overflow-hidden rounded-[2rem] bg-primary px-6 py-8 text-primary-foreground sm:px-10 sm:py-10">
      <div className="absolute -right-14 -top-20 h-72 w-72 rounded-full border border-white/10 sm:right-10 sm:top-[-115px] sm:h-96 sm:w-96" />
      <div className="relative grid gap-7 md:grid-cols-[1fr_auto] md:items-end">
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide"><MapPin size={14} /> NEIGHBOURHOOD BOOK EXCHANGE</div>
          <h1 className="serif text-[clamp(2.6rem,8vw,4.6rem)] leading-[.98] tracking-[-.04em]">Find your next<br /><span className="text-[#e9bd91]">well-loved read.</span></h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-primary-foreground/80 sm:text-lg">Browse books shared by real readers near you. When you’re done, pass one along.</p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          {user ? <Link href="/wishlist" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/30 px-4 text-sm font-semibold hover:bg-white/10" data-testid="link-discover-wishlist">My wishlist <ArrowRight size={15} /></Link> : <Link href="/auth" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/30 px-4 text-sm font-semibold hover:bg-white/10" data-testid="link-discover-sign-in">Sign in <ArrowRight size={15} /></Link>}
          <Link href="/add" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#f2d3ad] px-4 text-sm font-semibold text-[#254f3d] hover:-translate-y-0.5" data-testid="link-discover-share-book">Share a book <BookOpen size={16} /></Link>
        </div>
      </div>
      <div className="relative mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/15 pt-4 text-xs text-primary-foreground/75">
        <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} /> No sample listings</span>
        <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> Approximate areas only</span>
      </div>
    </section>

    {!isSupabaseConfigured && <Notice kind="error" testId="status-discover-setup"><strong className="text-foreground">Supabase setup needed.</strong> Nearby listings will appear once <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> are configured.</Notice>}
    {isSupabaseConfigured && locationError && <Notice kind="error" testId="status-location-error">{locationError}</Notice>}
    {locationMessage && <Notice kind="success" testId="status-location-saved">{locationMessage}</Notice>}

    <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm sm:p-7">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-accent"><SlidersHorizontal size={14} /> Browse the real nearby shelf</p><h2 className="serif mt-2 text-2xl">Find a book</h2></div>
        <span className="text-sm text-muted-foreground" data-testid="text-discover-result-count">{loading ? 'Searching…' : error ? 'Results unavailable' : `${books.length} ${books.length === 1 ? 'book' : 'books'} available`}</span>
      </div>
      <form onSubmit={applyFilters} className="mt-5 space-y-4">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={draft.query} onChange={(event) => updateDraft('query', event.target.value)} placeholder="Search by title or author" aria-label="Search books by title or author" className="h-12 pl-10" data-testid="input-discover-query" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1.5 text-sm font-medium">Genre
            <Input value={draft.genre} onChange={(event) => updateDraft('genre', event.target.value)} placeholder="Any genre" data-testid="input-filter-genre" />
          </label>
          <label className="space-y-1.5 text-sm font-medium">Condition
            <select value={draft.condition} onChange={(event) => updateDraft('condition', event.target.value as BookCondition | '')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" aria-label="Filter by book condition" data-testid="select-filter-condition">
              <option value="">Any condition</option>{conditions.map((condition) => <option key={condition} value={condition}>{conditionNames[condition]}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-sm font-medium">Language
            <Input value={draft.language} onChange={(event) => updateDraft('language', event.target.value)} placeholder="Any language" data-testid="input-filter-language" />
          </label>
          <label className="space-y-1.5 text-sm font-medium">Town or area
            <Input value={draft.area} onChange={(event) => updateDraft('area', event.target.value)} placeholder="Narok, Kilimani…" data-testid="input-filter-area" />
          </label>
          <label className="space-y-1.5 text-sm font-medium">Distance
            <select value={draft.distanceKm === null ? 'any' : String(draft.distanceKm)} onChange={(event) => updateDraft('distanceKm', event.target.value === 'any' ? null : Number(event.target.value) as 5 | 20 | 50)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" aria-label="Filter by distance" data-testid="select-filter-distance">
              <option value="any">Anywhere</option>
              <option value="5" disabled={!savedLocation}>Within 5 km</option>
              <option value="20" disabled={!savedLocation}>Within 20 km</option>
              <option value="50" disabled={!savedLocation}>Within 50 km</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" className="h-10 flex-1 rounded-xl" data-testid="button-apply-discover-filters"><Search size={16} className="mr-2" />Find books</Button>
            <Button type="button" variant="outline" onClick={clearFilters} aria-label="Clear filters" className="h-10 rounded-xl" data-testid="button-clear-discover-filters">Clear</Button>
          </div>
        </div>
      </form>
      <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl bg-secondary/65 p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-2.5"><LocateFixed size={17} className="mt-0.5 shrink-0 text-primary" /><div><p className="text-sm font-semibold">{savedLocation ? 'Approximate area saved' : 'See books by distance'}</p><p className="mt-0.5 max-w-xl text-xs leading-5 text-muted-foreground">{savedLocation ? 'Distance is approximate. Your coordinates are rounded to about 1 km.' : 'Save an approximate area to filter by radius. BookSwap does not request location until you tap the button.'}</p></div></div>
        {user ? <Button type="button" variant="outline" disabled={locationLoading || !isSupabaseConfigured} onClick={() => void saveLocation()} className="h-10 shrink-0 rounded-full" data-testid="button-save-approximate-location">{locationLoading ? <RefreshCw size={15} className="mr-2 animate-spin" /> : <LocateFixed size={15} className="mr-2" />}{savedLocation ? 'Update approximate area' : 'Save approximate location'}</Button> : <Link href="/auth" className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold hover:bg-background" data-testid="link-location-sign-in">Sign in to save area</Link>}
      </div>
    </section>

    <section aria-labelledby="nearby-books-heading">
      <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-accent">From nearby readers</p><h2 id="nearby-books-heading" className="serif mt-1 text-3xl">On the shelf now</h2></div>{error && <Button variant="outline" onClick={retry} disabled={refreshing} className="rounded-full" data-testid="button-retry-discover">{refreshing ? <RefreshCw size={15} className="mr-2 animate-spin" /> : null}Retry</Button>}</div>
      {loading ? <div role="status" aria-label="Loading nearby books" data-testid="status-discover-loading" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-[310px] animate-pulse rounded-2xl bg-secondary/70" />)}</div>
        : !isSupabaseConfigured ? <Notice kind="info" testId="status-discover-unavailable">Connect Supabase to browse real local listings. No books are generated or shown as examples.</Notice>
          : error ? <Notice kind="error" testId="status-discover-error">{error}<button type="button" onClick={retry} disabled={refreshing} className="ml-2 font-semibold underline" data-testid="button-retry-discover-inline">{refreshing ? 'Retrying…' : 'Try again'}</button></Notice>
          : books.length === 0 ? <div className="rounded-[1.75rem] border border-dashed border-border bg-card px-5 py-12 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary"><BookOpen size={24} /></div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-accent">{hasFilters ? 'No matching titles' : 'A shelf still taking shape'}</p>
            <h3 className="serif mt-2 text-2xl">{hasFilters ? 'Try a wider search.' : 'No available books nearby yet.'}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{hasFilters ? 'Clear one or more filters and see what else neighbours have shared.' : 'When local readers share real listings, they’ll appear here. No sample books are shown.'}</p>
            {hasFilters && <Button variant="outline" onClick={clearFilters} className="mt-5 rounded-full" data-testid="button-empty-clear-filters">Clear filters</Button>}
          </div>
            : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{books.map((book) => <DiscoverBookCard key={book.id} book={book} />)}</div>}
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Sparkles size={13} /> Every listing comes from a real neighbour.</span><Link href="/wishlist" className="font-semibold text-primary hover:underline" data-testid="link-discover-wishlist-footer">Keep a private wishlist <ArrowRight size={13} className="ml-1 inline" /></Link></div>
  </div>;
}

function DiscoverBookCard({ book }: { book: NearbyBook }) {
  const photoUrl = book.photos?.[0] ? getPublicBookPhotoUrl(book.photos[0]) : null;
  const cover = book.cover_url || photoUrl;
  const reader = publicReaderName(book.owner);
  return <Link href={`/b/${encodeURIComponent(book.id)}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md" data-testid={`link-discover-book-${book.id}`}>
    <div className="relative flex h-52 items-center justify-center overflow-hidden bg-secondary/70">
      {cover ? <img src={cover} alt={isPrivateContactText(book.title) ? 'Book cover' : `Cover of ${book.title}`} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-[1.025]" data-testid={`img-discover-cover-${book.id}`} /> : <div className="grid h-20 w-20 place-items-center rounded-[1.5rem] bg-background text-primary"><BookOpen size={34} strokeWidth={1.5} /></div>}
      <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-foreground">{conditionNames[book.condition]}</span>
      {book.accepts_credits && <span className="absolute right-3 top-3 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold text-primary-foreground">Swap credits welcome</span>}
    </div>
    <div className="flex flex-1 flex-col p-4">
      <p className="text-xs font-semibold uppercase tracking-[.12em] text-accent">{book.genre || 'A book to discover'}</p>
      <h3 className="serif mt-1 line-clamp-2 text-[22px] leading-tight" data-testid={`text-discover-title-${book.id}`}>{isPrivateContactText(book.title) ? 'Book title shared privately' : book.title}</h3>
      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{isPrivateContactText(book.author) ? 'Author details shared privately' : book.author || 'Author not listed'}</p>
      <div className="mt-auto flex items-end justify-between gap-2 pt-5">
        <div><p className="text-sm font-medium">{reader}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12} />{approximateAreaLabel(book.area_name)}</p></div>
        {book.distance_km !== null && <span className="shrink-0 text-xs text-muted-foreground" data-testid={`text-book-distance-${book.id}`}>About {book.distance_km.toFixed(1)} km</span>}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs font-semibold text-primary"><span>{book.language || 'Language not listed'}</span><span className="inline-flex items-center gap-1">View book <ArrowRight size={14} /></span></div>
    </div>
  </Link>;
}
