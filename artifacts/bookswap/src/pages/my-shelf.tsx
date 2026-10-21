import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Clock3, MapPin, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/notice';
import { useAuth } from '@/lib/auth-context';
import { isSupabaseConfigured } from '@/lib/supabase';
import { deleteBook, getBookPhotoUrl, listMyBooks, type Book, type BookStatus } from '@/features/books/api';

const groups: { status: BookStatus; title: string; intro: string }[] = [
  { status: 'available', title: 'Available', intro: 'Ready to find another reader.' },
  { status: 'reserved', title: 'Reserved', intro: 'A neighbour has started arranging a handover.' },
  { status: 'swapped', title: 'Swapped', intro: 'Stories you’ve already passed along.' },
];
const statusStyle: Record<BookStatus, string> = {
  available: 'bg-primary/10 text-primary',
  reserved: 'bg-[#f2e7ce] text-[#755a2d] dark:bg-[#493f2e] dark:text-[#efcd8c]',
  swapped: 'bg-secondary text-muted-foreground',
};
const conditionLabels: Record<Book['condition'], string> = { like_new: 'Like new', good: 'Good', fair: 'Fair', worn: 'Well loved' };

export default function MyShelfPage() {
  const { user, loading: authLoading } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [deletingError, setDeletingError] = useState('');
  const [deletingSuccess, setDeletingSuccess] = useState('');
  const groupsWithBooks = useMemo(() => groups.map((group) => ({ ...group, books: books.filter((book) => book.status === group.status) })), [books]);

  const loadShelf = useCallback(async (quiet = false) => {
    if (!user || !isSupabaseConfigured) { setBooks([]); setLoading(false); return; }
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = await listMyBooks();
      setBooks(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your shelf could not be loaded.');
    } finally { setLoading(false); setRefreshing(false); }
  }, [user?.id]);

  useEffect(() => { void loadShelf(); }, [loadShelf]);

  const removeBook = async (book: Book) => {
    if (!window.confirm(`Remove “${book.title}” from your shelf? This cannot be undone.`)) return;
    setDeletingError('');
    setDeletingSuccess('');
    setDeletingId(book.id);
    try {
      const result = await deleteBook(book.id);
      setBooks((current) => current.filter((item) => item.id !== book.id));
      setDeletingSuccess(result.cleanupWarning ? `“${book.title}” was removed. ${result.cleanupWarning}` : `“${book.title}” was removed from your shelf.`);
    } catch (caught) {
      setDeletingError(caught instanceof Error ? caught.message : 'This listing could not be removed.');
    } finally { setDeletingId(''); }
  };

  if (authLoading) return <div className="mx-auto max-w-5xl space-y-4" aria-label="Checking sign in" data-testid="status-shelf-auth-loading"><div className="h-24 animate-pulse rounded-3xl bg-secondary" /><div className="h-72 animate-pulse rounded-3xl bg-secondary/70" /></div>;
  if (!user) return <section className="page-enter mx-auto max-w-xl rounded-[2rem] border border-border bg-card p-7 text-center sm:p-10">
    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary"><BookOpen /></div><h1 className="serif mt-5 text-3xl">Your shelf is yours</h1><p className="mt-2 leading-7 text-muted-foreground">Sign in to see the books you’ve listed and manage only your own books.</p>
    {!isSupabaseConfigured && <div className="mt-5 text-left"><Notice kind="error" testId="status-shelf-setup">Supabase is not configured. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> before signing in to view your shelf.</Notice></div>}
    <Link href="/auth" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground" data-testid="link-shelf-sign-in">Sign in to continue <ArrowRight size={16} /></Link>
  </section>;

  return <div className="page-enter mx-auto max-w-5xl space-y-7">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-accent">Your bookshelf</p><h1 className="serif mt-2 text-4xl tracking-tight">My Shelf</h1><p className="mt-2 max-w-xl leading-6 text-muted-foreground">Keep track of the books you’ve shared. Only your own listings appear here.</p></div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => void loadShelf(true)} disabled={refreshing || loading} className="rounded-full" data-testid="button-refresh-shelf"><RefreshCw size={15} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />Refresh</Button>
        <Link href="/add" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground" data-testid="link-shelf-add-book"><Plus size={16} />Add a book</Link>
      </div>
    </header>

    {!isSupabaseConfigured && <Notice kind="error" testId="status-shelf-setup"><strong className="text-foreground">Supabase setup needed.</strong> Your shelf can’t load until <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> are configured.</Notice>}
    {error && <Notice kind="error" testId="status-shelf-error"><span>{error}</span><button type="button" className="ml-2 font-semibold underline" onClick={() => void loadShelf()} data-testid="button-retry-shelf">Try again</button></Notice>}
    {deletingError && <Notice kind="error" testId="status-shelf-delete-error">{deletingError}</Notice>}
    {deletingSuccess && <Notice kind="success" testId="status-shelf-delete-success">{deletingSuccess}</Notice>}

    {loading ? <div role="status" aria-label="Loading your shelf" data-testid="status-shelf-loading" className="space-y-7">
      {groups.map(({ status }) => <div key={status}><div className="mb-3 h-7 w-40 animate-pulse rounded-lg bg-secondary" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><div className="h-52 animate-pulse rounded-2xl bg-secondary/70" /><div className="h-52 animate-pulse rounded-2xl bg-secondary/70" /></div></div>)}
    </div> : !error && books.length === 0 ? <div className="rounded-[2rem] border border-dashed border-border bg-card px-5 py-12 text-center sm:px-10">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-[1.3rem] bg-secondary text-primary"><BookOpen size={28} /></div>
      <p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-accent">A shelf with room to grow</p>
      <h2 className="serif mt-2 text-3xl">No books listed yet.</h2><p className="mx-auto mt-3 max-w-md leading-7 text-muted-foreground">When you add a book, your real listings will appear here. Nothing is filled in with sample data.</p>
      <Link href="/add" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground" data-testid="link-empty-shelf-add"><Plus size={17} />Share your first book</Link>
    </div> : !error && <div className="space-y-9">
      {groupsWithBooks.map((group) => <section key={group.status} aria-labelledby={`heading-${group.status}`} data-testid={`section-shelf-${group.status}`}>
        <div className="mb-4 flex items-end justify-between gap-3 border-b border-border pb-3">
          <div><h2 id={`heading-${group.status}`} className="serif text-2xl">{group.title}</h2><p className="mt-1 text-sm text-muted-foreground">{group.intro}</p></div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground" data-testid={`count-shelf-${group.status}`}>{group.books.length} {group.books.length === 1 ? 'book' : 'books'}</span>
        </div>
        {group.books.length === 0 ? <p className="rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground" data-testid={`empty-shelf-${group.status}`}>No books in this group.</p> :
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.books.map((book) => <BookCard key={book.id} book={book} deleting={deletingId === book.id} onDelete={() => void removeBook(book)} />)}
          </div>}
      </section>)}
    </div>}
  </div>;
}

function BookCard({ book, deleting, onDelete }: { book: Book; deleting: boolean; onDelete: () => void }) {
  const cover = book.book_photos?.[0] ? getBookPhotoUrl(book.book_photos[0]) : book.cover_url;
  return <article className="flex min-h-[190px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm" data-testid={`card-shelf-book-${book.id}`}>
    <div className="flex flex-1 gap-4 p-4">
      {cover ? <img src={cover} alt={`Cover of ${book.title}`} className="h-32 w-[5.25rem] shrink-0 rounded-xl border border-border object-cover" data-testid={`img-shelf-cover-${book.id}`} /> : <div className="grid h-32 w-[5.25rem] shrink-0 place-items-center rounded-xl bg-secondary text-primary" aria-hidden="true"><BookOpen size={27} /></div>}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusStyle[book.status]}`} data-testid={`status-book-${book.id}`}>{book.status === 'available' ? 'Available' : book.status === 'reserved' ? 'Reserved' : 'Swapped'}</span><span className="text-xs text-muted-foreground">{conditionLabels[book.condition]}</span></div>
        <h3 className="serif mt-2 line-clamp-2 text-xl leading-tight" data-testid={`text-book-title-${book.id}`}>{book.title}</h3>
        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{book.author || 'Author not listed'}</p>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground" data-testid={`text-book-area-${book.id}`}><MapPin size={13} />{book.area_name}</p>
        {book.genre && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{book.genre}</p>}
        <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 size={12} />Listed {formatDate(book.created_at)}</p>
      </div>
    </div>
    <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{book.accepts_credits ? 'Open to swap credits' : 'Credits not requested'}</span>
      <div className="flex gap-1">
        <Link href={`/add?book=${encodeURIComponent(book.id)}`} aria-label={`Edit ${book.title}`} className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold text-primary hover:bg-secondary" data-testid={`link-edit-book-${book.id}`}>Edit</Link>
        <button type="button" onClick={onDelete} disabled={deleting} aria-label={`Delete ${book.title}`} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-60" data-testid={`button-delete-book-${book.id}`}>{deleting ? <span className="animate-pulse">Removing</span> : <><Trash2 size={14} />Remove</>}</button>
      </div>
    </div>
  </article>;
}
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'recently' : new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}
