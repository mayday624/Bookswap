import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, ArrowRight, BadgeCheck, BookOpen, CheckCircle2, Clock3, MapPin, ShieldCheck, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/notice';
import { useAuth } from '@/lib/auth-context';
import { isSupabaseConfigured } from '@/lib/supabase';
import { approximateAreaLabel, isPrivateContactText, publicReaderName } from '@/lib/public-reader';
import { getDiscoverBook, getPublicBookPhotoUrl, type BookDetail } from '@/features/discover/api';

const conditionLabels: Record<BookDetail['condition'], string> = { like_new: 'Like new', good: 'Good', fair: 'Fair', worn: 'Well loved' };
type GalleryImage = { url: string; alt: string; key: string };

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const loadBook = async (quiet = false) => {
    if (!id || !isSupabaseConfigured) { setLoading(false); return; }
    if (quiet) setRetrying(true); else setLoading(true);
    setError('');
    try {
      const result = await getDiscoverBook(id);
      setBook(result);
      setSelectedImage(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This book could not be loaded.');
    } finally { setLoading(false); setRetrying(false); }
  };
  useEffect(() => { void loadBook(); }, [id, isSupabaseConfigured]);
  const gallery = useMemo<GalleryImage[]>(() => {
    if (!book) return [];
    const entries: GalleryImage[] = [];
    const publicTitle = isPrivateContactText(book.title) ? 'this book' : book.title;
    if (book.cover_url) entries.push({ url: book.cover_url, alt: `Cover of ${publicTitle}`, key: 'cover' });
    for (const [index, photo] of (book.photos ?? []).entries()) {
      const url = getPublicBookPhotoUrl(photo);
      if (url && !entries.some((entry) => entry.url === url)) entries.push({ url, alt: `Condition photo ${index + 1} of ${publicTitle}`, key: photo.id });
    }
    return entries;
  }, [book]);
  const displayedImage = gallery[selectedImage] ?? gallery[0];

  if (loading) return <div role="status" aria-label="Loading book details" data-testid="status-detail-loading" className="mx-auto max-w-5xl space-y-5"><div className="h-10 w-28 animate-pulse rounded-xl bg-secondary" /><div className="grid gap-8 lg:grid-cols-2"><div className="h-[420px] animate-pulse rounded-[2rem] bg-secondary/70" /><div className="h-[420px] animate-pulse rounded-[2rem] bg-secondary/70" /></div></div>;
  if (!isSupabaseConfigured) return <section className="mx-auto max-w-2xl"><Notice kind="error" testId="status-detail-setup"><strong className="text-foreground">Supabase setup needed.</strong> Book details are loaded from real listings and are unavailable until the project URL and public key are configured.</Notice><Link href="/" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline" data-testid="link-detail-home"><ArrowLeft size={15} /> Back to Discover</Link></section>;
  if (error || !book) return <section className="page-enter mx-auto max-w-2xl rounded-[2rem] border border-border bg-card p-6 sm:p-9">
    <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline" data-testid="link-detail-back"><ArrowLeft size={15} /> Discover</Link>
    <div className="mt-8"><Notice kind="error" testId="status-detail-error">{error || 'This listing could not be found.'}</Notice></div>
    <div className="mt-5 flex gap-2"><Button variant="outline" onClick={() => void loadBook(true)} disabled={retrying} className="rounded-full" data-testid="button-retry-detail">{retrying ? 'Trying again…' : 'Try again'}</Button><Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-primary hover:bg-secondary" data-testid="link-detail-discover">Browse Discover <ArrowRight size={15} /></Link></div>
  </section>;

  const reader = publicReaderName(book.owner);
  const isOwner = user?.id === book.owner_id;
  const safeBookTitle = isPrivateContactText(book.title) ? 'Book details shared privately' : book.title;
  const safeAuthor = isPrivateContactText(book.author) ? 'Author details shared privately' : book.author || 'Author not listed';
  return <div className="page-enter mx-auto max-w-5xl space-y-6">
    <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline" data-testid="link-detail-back"><ArrowLeft size={15} /> Back to Discover</Link>
    <article className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm" data-testid={`article-book-detail-${book.id}`}>
      <div className="grid lg:grid-cols-[.92fr_1.08fr]">
        <section className="bg-secondary/50 p-4 sm:p-6 lg:p-8" aria-label="Book photos">
          <div className="relative flex min-h-[310px] items-center justify-center overflow-hidden rounded-[1.5rem] bg-secondary sm:min-h-[450px]">
            {displayedImage ? <img src={displayedImage.url} alt={displayedImage.alt} className="absolute inset-0 h-full w-full object-contain" data-testid="img-detail-active-photo" /> : <div className="flex flex-col items-center gap-3 text-primary/70"><BookOpen size={62} strokeWidth={1.25} /><span className="text-sm">No cover photo shared</span></div>}
            <span className="absolute left-4 top-4 rounded-full border border-border/60 bg-background/90 px-3 py-1.5 text-xs font-semibold text-foreground" data-testid="status-detail-condition">{conditionLabels[book.condition]}</span>
          </div>
          {gallery.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Choose a book photo">
            {gallery.map((image, index) => <button key={image.key} type="button" onClick={() => setSelectedImage(index)} aria-label={`Show ${image.alt}`} aria-pressed={selectedImage === index} className={`h-16 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${selectedImage === index ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'}`} data-testid={`button-detail-photo-${index}`}><img src={image.url} alt="" className="h-full w-full object-cover" /></button>)}
          </div>}
          {gallery.length > 0 && <p className="mt-3 text-xs text-muted-foreground" data-testid="text-detail-photo-count">{gallery.length} {gallery.length === 1 ? 'photo' : 'photos'} shared</p>}
        </section>
        <section className="flex flex-col p-5 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center gap-2">
            {book.genre && <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">{book.genre}</span>}
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary" data-testid="status-detail-availability">{book.status === 'available' ? 'Available to swap' : book.status === 'reserved' ? 'Reserved' : 'Already swapped'}</span>
          </div>
          <h1 className="serif mt-5 text-[clamp(2.2rem,5vw,3.5rem)] leading-[1.02] tracking-tight" data-testid="text-detail-title">{safeBookTitle}</h1>
          <p className="mt-2 text-lg text-muted-foreground" data-testid="text-detail-author">{safeAuthor}</p>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-y border-border py-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><MapPin size={15} className="text-primary" />Approximate area: <strong className="font-semibold text-foreground" data-testid="text-detail-area">{approximateAreaLabel(book.area_name)}</strong></span>
            {book.distance_km !== null && <span className="inline-flex items-center gap-1.5" data-testid="text-detail-distance"><MapPin size={14} />About {book.distance_km.toFixed(1)} km away</span>}
            <span className="inline-flex items-center gap-1.5"><BookOpen size={15} />{book.language}</span>
          </div>
          {book.description && !isPrivateContactText(book.description) && <div className="mt-6"><h2 className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">About this book</h2><p className="mt-2 whitespace-pre-line leading-7" data-testid="text-detail-description">{book.description}</p></div>}
          {book.personal_note && !isPrivateContactText(book.personal_note) && <blockquote className="mt-5 rounded-xl border-l-2 border-accent bg-secondary/50 px-4 py-3 text-sm leading-6 text-foreground" data-testid="text-detail-note">“{book.personal_note}”</blockquote>}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {book.isbn && <DetailFact label="ISBN" value={book.isbn} />}
            <DetailFact label="Condition" value={conditionLabels[book.condition]} />
            <DetailFact label="Credits" value={book.accepts_credits ? 'Open to swap credits' : 'Not requested'} />
          </div>
          <div className="mt-auto pt-7">
            {isOwner ? <Notice testId="status-own-listing">This is your listing. You can manage it from <Link href={`/add?book=${encodeURIComponent(book.id)}`} className="font-semibold underline" data-testid="link-edit-own-detail">Edit listing</Link> or <Link href="/shelf" className="font-semibold underline" data-testid="link-own-detail-shelf">My Shelf</Link>.</Notice>
              : book.status !== 'available' ? <Notice testId="status-swap-unavailable">This book is not currently available for a swap.</Notice>
                : user ? <div className="space-y-3"><Button type="button" disabled className="h-12 w-full rounded-xl" data-testid="button-request-swap"><ArrowRight size={16} className="mr-2" />Request swap</Button><Notice testId="status-swap-coming-soon">Swap requests are being added in the next milestone. Nothing has been sent.</Notice></div>
                  : <Link href="/auth" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground" data-testid="link-detail-sign-in-swap">Sign in to request a swap <ArrowRight size={16} /></Link>}
          </div>
        </section>
      </div>
      <section className="border-t border-border bg-background/50 p-5 sm:p-7" aria-labelledby="reader-card-heading">
        <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
          <div className="flex items-start gap-4">
            {book.owner?.avatar_url ? <img src={book.owner.avatar_url} alt="" className="h-14 w-14 rounded-2xl border border-border object-cover" data-testid="img-detail-owner-avatar" /> : <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-secondary text-primary" aria-hidden="true"><span className="serif text-xl">{reader.trim().charAt(0).toUpperCase()}</span></div>}
            <div><p className="text-xs font-bold uppercase tracking-[.14em] text-accent">Shared by</p><h2 id="reader-card-heading" className="serif mt-1 text-2xl" data-testid="text-detail-reader">{reader}</h2><p className="mt-1 text-sm text-muted-foreground">A reader in the BookSwap community</p></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4" data-testid="status-reader-rating">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground"><Star size={14} className="text-accent" /> Reader rating</p>
              {book.rating_count > 0 && book.average_rating !== null ? <p className="mt-2 text-lg font-semibold">{book.average_rating.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">/ 5 · {book.rating_count} {book.rating_count === 1 ? 'rating' : 'ratings'}</span></p> : <p className="mt-2 text-sm text-muted-foreground">No swap ratings yet</p>}
            </div>
            <div className="rounded-xl border border-border bg-card p-4" data-testid="status-reader-swaps">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground"><CheckCircle2 size={14} className="text-primary" /> Swap history</p>
              <p className="mt-2 text-lg font-semibold">{book.completed_swaps} <span className="text-sm font-normal text-muted-foreground">{book.completed_swaps === 1 ? 'completed swap' : 'completed swaps'}</span></p>
            </div>
            {book.trusted_swapper && <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm font-semibold text-primary sm:col-span-2" data-testid="status-trusted-swapper"><BadgeCheck size={18} /> Trusted swapper</div>}
          </div>
        </div>
        <p className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-xs leading-5 text-muted-foreground"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary" />BookSwap shows only a public reader summary and approximate handover area here. Private contact details are never shown on a book page.</p>
      </section>
    </article>
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 size={13} />Listed {formatDate(book.created_at)}</p>
  </div>;
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-secondary/60 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'recently' : new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}
