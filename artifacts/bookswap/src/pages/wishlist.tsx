import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, BookHeart, BookOpen, LoaderCircle, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/notice';
import { useAuth } from '@/lib/auth-context';
import { isSupabaseConfigured } from '@/lib/supabase';
import { deleteWishlistItem, listWishlist, saveWishlistItem, type WishlistInput, type WishlistItem } from '@/features/discover/api';
import { normalizeIsbn } from '@/features/books/api';

const schema = z.object({
  title: z.string().trim().max(140, 'Keep the title under 140 characters.'),
  author: z.string().trim().max(100, 'Keep the author under 100 characters.'),
  isbn: z.string().trim().max(24, 'Check the ISBN length.'),
  genre: z.string().trim().max(60, 'Keep the genre under 60 characters.'),
}).refine((values) => Boolean(values.title || values.isbn || values.genre), {
  message: 'Add a title, ISBN, or genre so this wish is useful.',
  path: ['title'],
});
type WishlistValues = z.infer<typeof schema>;
const blank: WishlistValues = { title: '', author: '', isbn: '', genre: '' };

export default function WishlistPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const form = useForm<WishlistValues>({ resolver: zodResolver(schema), defaultValues: blank });

  const loadItems = useCallback(async () => {
    if (!user || !isSupabaseConfigured) { setItems([]); setLoading(false); return; }
    setLoading(true);
    setLoadError('');
    try { setItems(await listWishlist()); }
    catch (caught) { setLoadError(caught instanceof Error ? caught.message : 'Your wishlist could not be loaded.'); }
    finally { setLoading(false); }
  }, [user?.id]);
  useEffect(() => { void loadItems(); }, [loadItems]);

  const resetForm = () => {
    setEditingId(null);
    setFeedback(null);
    form.reset(blank);
  };
  const submit = async (values: WishlistValues) => {
    setFeedback(null);
    if (!user) { setFeedback({ kind: 'error', text: 'Sign in before saving a wishlist item.' }); return; }
    if (!isSupabaseConfigured) { setFeedback({ kind: 'error', text: 'Supabase is not configured. This wishlist item has not been saved.' }); return; }
    setSaving(true);
    const input: WishlistInput = { ...values, isbn: normalizeIsbn(values.isbn) };
    try {
      const saved = await saveWishlistItem(input, editingId ?? undefined);
      setItems((current) => editingId ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setEditingId(null);
      form.reset(blank);
      setFeedback({ kind: 'success', text: editingId ? 'Your wishlist item is updated.' : 'Your wishlist item is saved.' });
    } catch (caught) {
      setFeedback({ kind: 'error', text: caught instanceof Error ? caught.message : 'Your wishlist item could not be saved.' });
    } finally { setSaving(false); }
  };
  const editItem = (item: WishlistItem) => {
    setEditingId(item.id);
    setFeedback(null);
    form.reset({ title: item.title ?? '', author: item.author ?? '', isbn: item.isbn ?? '', genre: item.genre ?? '' });
    document.getElementById('wishlist-form-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const removeItem = async (item: WishlistItem) => {
    if (!window.confirm(`Remove “${item.title || item.genre || item.isbn || 'this wish'}” from your private wishlist?`)) return;
    setDeletingId(item.id);
    setFeedback(null);
    try {
      await deleteWishlistItem(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (editingId === item.id) resetForm();
      setFeedback({ kind: 'success', text: 'That wishlist item was removed.' });
    } catch (caught) {
      setFeedback({ kind: 'error', text: caught instanceof Error ? caught.message : 'That wishlist item could not be removed.' });
    } finally { setDeletingId(''); }
  };

  if (authLoading) return <div className="mx-auto max-w-4xl space-y-4" role="status" aria-label="Checking sign in" data-testid="status-wishlist-auth-loading"><div className="h-24 animate-pulse rounded-3xl bg-secondary" /><div className="h-72 animate-pulse rounded-3xl bg-secondary/70" /></div>;
  if (!user) return <section className="page-enter mx-auto max-w-xl rounded-[2rem] border border-border bg-card p-7 text-center sm:p-10">
    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary"><BookHeart /></div><h1 className="serif mt-5 text-3xl">A private list for your next read</h1><p className="mt-2 leading-7 text-muted-foreground">Your wishlist is only visible to you. Sign in to keep track of titles and genres you’re hoping to find.</p>
    {!isSupabaseConfigured && <div className="mt-5 text-left"><Notice kind="error" testId="status-wishlist-setup">Supabase is not configured. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> before signing in.</Notice></div>}
    <Link href="/auth" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground" data-testid="link-wishlist-sign-in">Sign in to view your wishlist <ArrowRight size={16} /></Link>
  </section>;

  return <div className="page-enter mx-auto max-w-5xl space-y-7">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline" data-testid="link-wishlist-discover"><ArrowRight className="rotate-180" size={15} /> Discover</Link><p className="mt-4 text-xs font-bold uppercase tracking-[.16em] text-accent">For the books you haven’t found yet</p><h1 className="serif mt-1 text-4xl tracking-tight">My wishlist</h1><p className="mt-2 max-w-xl leading-6 text-muted-foreground">Keep a private note of titles, authors, ISBNs, or genres you’d love to read.</p></div>
      <span className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-2 text-xs font-semibold text-primary" data-testid="status-wishlist-private"><BookHeart size={15} /> Private to you</span>
    </header>
    {!isSupabaseConfigured && <Notice kind="error" testId="status-wishlist-setup"><strong className="text-foreground">Supabase setup needed.</strong> Wishlist items cannot be loaded or saved until the project URL and public key are configured.</Notice>}
    {feedback && <Notice kind={feedback.kind} testId="status-wishlist-feedback">{feedback.text}</Notice>}
    {loadError && <Notice kind="error" testId="status-wishlist-error">{loadError}<button type="button" onClick={() => void loadItems()} className="ml-2 font-semibold underline" data-testid="button-retry-wishlist">Try again</button></Notice>}

    <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="wishlist-form-heading">
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Plus size={19} /></span><div><h2 id="wishlist-form-heading" className="serif text-2xl">{editingId ? 'Edit this wish' : 'Add to your wishlist'}</h2><p className="mt-1 text-sm text-muted-foreground">A title, ISBN, or genre is enough to save a wish.</p></div></div>
      <Form {...form}><form onSubmit={form.handleSubmit(submit)} className="mt-5 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="title" render={({ field }) => <FormItem><FormLabel>Book title</FormLabel><FormControl><Input placeholder="A title you’re looking for" maxLength={140} data-testid="input-wishlist-title" {...field} /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="author" render={({ field }) => <FormItem><FormLabel>Author <span className="font-normal text-muted-foreground">(optional)</span></FormLabel><FormControl><Input placeholder="Author name" maxLength={100} data-testid="input-wishlist-author" {...field} /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="isbn" render={({ field }) => <FormItem><FormLabel>ISBN <span className="font-normal text-muted-foreground">(optional)</span></FormLabel><FormControl><Input placeholder="ISBN-10 or ISBN-13" data-testid="input-wishlist-isbn" {...field} onChange={(event) => field.onChange(normalizeIsbn(event.target.value))} /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="genre" render={({ field }) => <FormItem><FormLabel>Genre <span className="font-normal text-muted-foreground">(optional)</span></FormLabel><FormControl><Input placeholder="A genre-only wish works too" maxLength={60} data-testid="input-wishlist-genre" {...field} /></FormControl><FormMessage /></FormItem>} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving || !isSupabaseConfigured} className="rounded-xl" data-testid="button-save-wishlist">{saving ? <LoaderCircle size={16} className="mr-2 animate-spin" /> : editingId ? <Pencil size={15} className="mr-2" /> : <Plus size={16} className="mr-2" />}{editingId ? 'Save changes' : 'Save wish'}</Button>
          {editingId && <Button type="button" variant="outline" onClick={resetForm} className="rounded-xl" data-testid="button-cancel-wishlist-edit"><X size={15} className="mr-2" />Cancel edit</Button>}
        </div>
      </form></Form>
    </section>

    <section aria-labelledby="wishlist-items-heading">
      <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-accent">Your saved wishes</p><h2 id="wishlist-items-heading" className="serif mt-1 text-3xl">The reading list</h2></div>{!loading && !loadError && <span className="text-sm text-muted-foreground" data-testid="text-wishlist-count">{items.length} {items.length === 1 ? 'wish' : 'wishes'}</span>}</div>
      {loading ? <div role="status" aria-label="Loading private wishlist" data-testid="status-wishlist-loading" className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-secondary/70" />)}</div>
        : loadError ? null
          : !isSupabaseConfigured ? <Notice kind="error" testId="status-wishlist-unavailable">Connect Supabase to load your private wishlist.</Notice>
            : items.length === 0 ? <div className="rounded-[1.75rem] border border-dashed border-border bg-card px-5 py-10 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary"><BookOpen size={23} /></div><h3 className="serif mt-4 text-2xl">Nothing on your list yet.</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Add a title or a genre you’re hoping to come across. This list stays private to your account.</p>
            </div>
              : <div className="grid gap-3 sm:grid-cols-2">{items.map((item) => <WishlistCard key={item.id} item={item} deleting={deletingId === item.id} onEdit={() => editItem(item)} onDelete={() => void removeItem(item)} />)}</div>}
    </section>
  </div>;
}

function WishlistCard({ item, deleting, onEdit, onDelete }: { item: WishlistItem; deleting: boolean; onEdit: () => void; onDelete: () => void }) {
  return <article className="flex min-h-36 flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-sm" data-testid={`card-wishlist-${item.id}`}>
    <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><BookOpen size={19} /></span><div className="min-w-0">
      <h3 className="serif text-xl leading-tight" data-testid={`text-wishlist-title-${item.id}`}>{item.title || item.genre || (item.isbn ? `ISBN ${item.isbn}` : 'Wishlist item')}</h3>
      {item.author && <p className="mt-1 text-sm text-muted-foreground">{item.author}</p>}
      <div className="mt-2 flex flex-wrap gap-2">{item.genre && <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">{item.genre}</span>}{item.isbn && <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">ISBN {item.isbn}</span>}</div>
    </div></div>
    <div className="mt-4 flex justify-end gap-1 border-t border-border pt-2">
      <button type="button" onClick={onEdit} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-primary hover:bg-secondary" data-testid={`button-edit-wishlist-${item.id}`}><Pencil size={14} />Edit</button>
      <button type="button" onClick={onDelete} disabled={deleting} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-60" data-testid={`button-delete-wishlist-${item.id}`}>{deleting ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}Remove</button>
    </div>
  </article>;
}
