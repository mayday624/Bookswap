import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, Barcode, BookOpen, Check, ImagePlus, LoaderCircle, Search, ShieldCheck, Upload, X } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Notice } from '@/components/notice';
import { useAuth } from '@/lib/auth-context';
import { isSupabaseConfigured } from '@/lib/supabase';
import { listMyBooks, lookupOpenLibrary, normalizeIsbn, saveBook, scanIsbn, uploadBookPhotos, type Book, type BookCondition, type BookInput, type OpenLibraryBook } from '@/features/books/api';

const listingSchema = z.object({
  title: z.string().trim().min(1, 'Add the book title.').max(140, 'Keep the title under 140 characters.'),
  author: z.string().trim().max(100, 'Keep the author under 100 characters.'),
  isbn: z.string().trim().max(24, 'Check the ISBN length.'),
  description: z.string().trim().max(1200, 'Keep the description under 1,200 characters.'),
  cover_url: z.union([z.literal(''), z.string().url('Enter a complete image URL.')]),
  condition: z.enum(['like_new', 'good', 'fair', 'worn']),
  genre: z.string().trim().max(60, 'Keep the genre under 60 characters.'),
  language: z.string().trim().min(1, 'Add the book language.').max(40, 'Keep the language under 40 characters.'),
  personal_note: z.string().trim().max(280, 'Keep the note under 280 characters.'),
  accepts_credits: z.boolean(),
  area_name: z.string().trim().min(1, 'Add a town or area for the handover.').max(80, 'Keep the area under 80 characters.'),
});
type ListingValues = z.infer<typeof listingSchema>;
type SelectedPhoto = { file: File; preview: string };
const initialValues: ListingValues = { title: '', author: '', isbn: '', description: '', cover_url: '', condition: 'good', genre: '', language: 'English', personal_note: '', accepts_credits: false, area_name: '' };
const conditionChoices: { value: BookCondition; label: string; description: string }[] = [
  { value: 'like_new', label: 'Like new', description: 'Very little sign of reading' },
  { value: 'good', label: 'Good', description: 'Light signs of use' },
  { value: 'fair', label: 'Fair', description: 'Some wear, still a good read' },
  { value: 'worn', label: 'Well loved', description: 'Visible wear, all pages intact' },
];

export default function AddBookPage() {
  const [location, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const editId = new URLSearchParams(window.location.search).get('book');
  const [loadingBook, setLoadingBook] = useState(Boolean(editId));
  const [loadError, setLoadError] = useState('');
  const [existingPhotoCount, setExistingPhotoCount] = useState(0);
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
  const photoRef = useRef<SelectedPhoto[]>([]);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [libraryResult, setLibraryResult] = useState<OpenLibraryBook | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [savedBookId, setSavedBookId] = useState('');
  const [savedBook, setSavedBook] = useState<Book | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const form = useForm<ListingValues>({ resolver: zodResolver(listingSchema), defaultValues: initialValues });
  const saving = form.formState.isSubmitting || saveBusy;

  useEffect(() => () => {
    photoRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview));
  }, []);
  useEffect(() => {
    let active = true;
    setFeedback(null);
    setLoadError('');
    setSavedBookId('');
    setSavedBook(null);
    if (!editId) {
      form.reset(initialValues);
      setExistingPhotoCount(0);
      setLoadingBook(false);
      return () => { active = false; };
    }
    if (!user || !isSupabaseConfigured) {
      setLoadingBook(false);
      return () => { active = false; };
    }
    setLoadingBook(true);
    void listMyBooks().then((books) => {
      if (!active) return;
      const book = books.find((item) => item.id === editId);
      if (!book) {
        setLoadError('That listing is not on your shelf. Only your own books can be edited.');
        return;
      }
      setSavedBook(book);
      setSavedBookId(book.id);
      setExistingPhotoCount(book.book_photos?.length ?? 0);
      form.reset(bookToValues(book));
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : 'This listing could not be loaded.');
    }).finally(() => {
      if (active) setLoadingBook(false);
    });
    return () => { active = false; };
  }, [editId, user?.id]);

  const setPhotos = (photos: SelectedPhoto[]) => {
    photoRef.current = photos;
    setSelectedPhotos(photos);
  };
  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    setPhotoError('');
    const available = 3 - existingPhotoCount - selectedPhotos.length;
    const incoming = Array.from(files);
    if (available <= 0) { setPhotoError('This listing already has three photos.'); return; }
    const accepted: File[] = [];
    for (const file of incoming) {
      if (!file.type.startsWith('image/')) { setPhotoError('Choose image files only.'); continue; }
      if (accepted.length < available) accepted.push(file);
      else setPhotoError(`You can add ${available} more photo${available === 1 ? '' : 's'} to this listing.`);
    }
    if (accepted.length) setPhotos([...selectedPhotos, ...accepted.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    if (photoInput.current) photoInput.current.value = '';
  };
  const removePhoto = (preview: string) => {
    URL.revokeObjectURL(preview);
    setPhotos(selectedPhotos.filter((photo) => photo.preview !== preview));
    setPhotoError('');
  };

  const runLookup = async () => {
    setLibraryError('');
    setLibraryResult(null);
    const query = libraryQuery.trim();
    if (query.length < 2) { setLibraryError('Enter a title or ISBN with at least two characters.'); return; }
    setLibraryBusy(true);
    try {
      const result = await lookupOpenLibrary(query);
      if (!result) setLibraryError('No close match found. You can fill in the book details yourself.');
      else setLibraryResult(result);
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : 'Open Library could not be reached. You can enter the details manually.');
    } finally { setLibraryBusy(false); }
  };
  const applyLookup = () => {
    if (!libraryResult) return;
    form.setValue('title', libraryResult.title, { shouldValidate: true });
    form.setValue('author', libraryResult.author, { shouldValidate: true });
    form.setValue('isbn', normalizeIsbn(libraryResult.isbn), { shouldValidate: true });
    if (libraryResult.description) form.setValue('description', libraryResult.description, { shouldValidate: true });
    if (libraryResult.coverUrl) form.setValue('cover_url', libraryResult.coverUrl, { shouldValidate: true });
    setFeedback(null);
    setLibraryResult(null);
  };
  const runScan = async () => {
    setScanBusy(true);
    setScanMessage('Point your camera at the barcode on the back cover. Scanning will stop after 15 seconds.');
    try {
      const isbn = await scanIsbn();
      if (isbn) {
        form.setValue('isbn', normalizeIsbn(isbn), { shouldValidate: true, shouldDirty: true });
        setScanMessage('Barcode found. Check the ISBN before saving.');
      }
    } catch (error) {
      setScanMessage(error instanceof Error ? `${error.message} Enter the ISBN below instead.` : 'Scanning did not work. Enter the ISBN below instead.');
    } finally { setScanBusy(false); }
  };
  const onSubmit = async (values: ListingValues) => {
    setFeedback(null);
    setPhotoError('');
    if (!user) { setFeedback({ kind: 'error', text: 'Sign in before adding a book.' }); return; }
    if (!isSupabaseConfigured) { setFeedback({ kind: 'error', text: 'Supabase is not configured. This listing has not been saved.' }); return; }
    setSaveBusy(true);
    try {
      const input: BookInput = { ...values, isbn: normalizeIsbn(values.isbn) };
      const book = await saveBook(input, (editId ?? savedBookId) || undefined);
      setSavedBookId(book.id);
      setSavedBook(book);
      if (selectedPhotos.length) {
        try {
          const uploaded = await uploadBookPhotos(book.id, selectedPhotos.map(({ file }) => file));
          selectedPhotos.forEach(({ preview }) => URL.revokeObjectURL(preview));
          setPhotos([]);
          setExistingPhotoCount((count) => count + uploaded.length);
          setFeedback({ kind: 'success', text: uploaded.length ? `Your book listing is saved with ${uploaded.length} photo${uploaded.length === 1 ? '' : 's'}.` : 'Your book listing is saved.' });
        } catch (error) {
          setFeedback({ kind: 'error', text: `Your book listing is saved, but the ${selectedPhotos.length === 1 ? 'photo was' : 'photos were'} not uploaded. ${error instanceof Error ? error.message : 'Please try again.'}` });
        }
      } else {
        setFeedback({ kind: 'success', text: 'Your book listing is saved.' });
      }
    } catch (error) {
      setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'The listing could not be saved. Your changes are still here.' });
    } finally { setSaveBusy(false); }
  };

  if (authLoading) return <div className="mx-auto max-w-4xl space-y-4" aria-label="Checking sign in" data-testid="status-add-auth-loading"><div className="h-20 animate-pulse rounded-3xl bg-secondary" /><div className="h-[520px] animate-pulse rounded-3xl bg-secondary/70" /></div>;
  if (!user) return <section className="page-enter mx-auto max-w-xl rounded-[2rem] border border-border bg-card p-7 text-center sm:p-10">
    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary"><BookOpen /></div><h1 className="serif mt-5 text-3xl">Sign in to share a book</h1><p className="mt-2 leading-7 text-muted-foreground">Your listings belong to your reader profile. Sign in to add a title to your neighbourhood shelf.</p>
    {!isSupabaseConfigured && <div className="mt-5 text-left"><Notice kind="error" testId="status-add-setup">Supabase is not configured. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> before signing in or saving a listing.</Notice></div>}
    <Link href="/auth" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground" data-testid="link-add-sign-in">Sign in to continue <ArrowRight size={16} /></Link>
  </section>;
  return <div className="page-enter mx-auto max-w-4xl space-y-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><Link href="/shelf" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline" data-testid="link-add-back-shelf"><ArrowLeft size={15} /> My shelf</Link>
        <p className="mt-4 text-xs font-bold uppercase tracking-[.16em] text-accent">A story, passed along</p>
        <h1 className="serif mt-1 text-4xl tracking-tight">{editId ? 'Edit your listing' : 'Share a book'}</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">Add a few details so another reader nearby knows what they’re picking up.</p>
      </div>
      <Link href="/shelf" className="hidden items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary sm:inline-flex" data-testid="link-view-my-shelf">View my shelf <ArrowRight size={15} /></Link>
    </div>
    {!isSupabaseConfigured && <Notice kind="error" testId="status-add-setup"><strong className="text-foreground">Supabase setup needed.</strong> Your listing cannot be saved until <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> are configured.</Notice>}
    {feedback && <Notice kind={feedback.kind} testId="status-add-feedback">{feedback.text}{feedback.kind === 'error' && savedBookId && selectedPhotos.length > 0 && <span className="mt-1 block">Keep this page open and submit again to retry just these photos; the listing is already saved.</span>}</Notice>}
    {loadError && <Notice kind="error" testId="status-add-load-error">{loadError}<Link href="/shelf" className="ml-1 font-semibold underline" data-testid="link-load-error-shelf">Return to your shelf.</Link></Notice>}
    {loadingBook ? <div role="status" aria-label="Loading book listing" data-testid="status-book-loading" className="h-80 animate-pulse rounded-[1.75rem] bg-secondary" /> : !loadError && <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="serif text-2xl">Find the book</h2><p className="mt-1 text-sm text-muted-foreground">Search Open Library or enter details yourself.</p></div>
            <span className="hidden rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary sm:inline-flex">Optional lookup</span>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void runLookup(); } }} placeholder="Search by title or ISBN" aria-label="Search Open Library by title or ISBN" className="h-11 pl-10" data-testid="input-library-search" /></div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={libraryBusy} onClick={() => void runLookup()} className="h-11 flex-1 rounded-xl sm:flex-none" data-testid="button-library-search">{libraryBusy ? <LoaderCircle size={16} className="mr-2 animate-spin" /> : <Search size={16} className="mr-2" />}Search</Button>
              <Button type="button" variant="outline" disabled={scanBusy} onClick={() => void runScan()} className="h-11 flex-1 rounded-xl sm:flex-none" data-testid="button-scan-isbn">{scanBusy ? <LoaderCircle size={16} className="mr-2 animate-spin" /> : <Barcode size={17} className="mr-2" />}Scan ISBN</Button>
            </div>
          </div>
          {libraryBusy && <div role="status" className="mt-3 h-16 animate-pulse rounded-xl bg-secondary" data-testid="status-library-loading" />}
          {libraryError && <div className="mt-3"><Notice kind="info" testId="status-library-result">{libraryError}</Notice></div>}
          {scanMessage && <p role="status" className="mt-3 text-sm text-muted-foreground" data-testid="status-isbn-scan">{scanMessage}</p>}
          {libraryResult && <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center">
            {libraryResult.coverUrl ? <img src={libraryResult.coverUrl} alt={`Cover of ${libraryResult.title}`} className="h-24 w-16 rounded-lg border border-border object-cover" /> : <div className="grid h-24 w-16 place-items-center rounded-lg bg-secondary text-primary"><BookOpen size={24} /></div>}
            <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wider text-primary">Possible match</p><h3 className="mt-1 font-semibold">{libraryResult.title}</h3><p className="text-sm text-muted-foreground">{libraryResult.author || 'Author not listed'}{libraryResult.isbn ? ` · ISBN ${normalizeIsbn(libraryResult.isbn)}` : ''}</p></div>
            <Button type="button" onClick={applyLookup} className="rounded-xl" data-testid="button-use-library-result"><Check size={16} className="mr-2" />Use details</Button>
          </div>}
        </section>

        <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm sm:p-8">
          <div><h2 className="serif text-2xl">Book details</h2><p className="mt-1 text-sm text-muted-foreground">Add accurate details. You can change them later.</p></div>
          <div className="mt-6 grid gap-x-5 gap-y-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><FormField control={form.control} name="title" render={({ field }) => <FormItem><FormLabel>Title <RequiredMark /></FormLabel><FormControl><Input placeholder="The title on the cover" maxLength={140} data-testid="input-book-title" {...field} /></FormControl><FormMessage /></FormItem>} /></div>
            <FormField control={form.control} name="author" render={({ field }) => <FormItem><FormLabel>Author</FormLabel><FormControl><Input placeholder="Author name" maxLength={100} data-testid="input-book-author" {...field} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="isbn" render={({ field }) => <FormItem><FormLabel>ISBN <span className="font-normal text-muted-foreground">(optional)</span></FormLabel><FormControl><Input inputMode="text" autoCapitalize="characters" placeholder="978…" data-testid="input-book-isbn" {...field} onChange={(event) => field.onChange(normalizeIsbn(event.target.value))} /></FormControl><FormMessage /></FormItem>} />
            <div className="sm:col-span-2"><FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>Description <span className="font-normal text-muted-foreground">(optional)</span></FormLabel><FormControl><Textarea rows={4} maxLength={1200} placeholder="A short description, or a few words about the story." data-testid="input-book-description" {...field} /></FormControl><p className="text-xs text-muted-foreground">Up to 1,200 characters.</p><FormMessage /></FormItem>} /></div>
            <div className="sm:col-span-2"><FormField control={form.control} name="cover_url" render={({ field }) => <FormItem><FormLabel>Cover image URL <span className="font-normal text-muted-foreground">(optional)</span></FormLabel><FormControl><Input type="url" inputMode="url" placeholder="https://… or fill this from Open Library" data-testid="input-book-cover-url" {...field} /></FormControl><FormMessage /></FormItem>} /></div>
            <FormField control={form.control} name="genre" render={({ field }) => <FormItem><FormLabel>Genre</FormLabel><FormControl><Input placeholder="Fiction, history, memoir…" maxLength={60} data-testid="input-book-genre" {...field} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="language" render={({ field }) => <FormItem><FormLabel>Language <RequiredMark /></FormLabel><FormControl><Input placeholder="English" maxLength={40} data-testid="input-book-language" {...field} /></FormControl><FormMessage /></FormItem>} />
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm sm:p-8">
          <div><h2 className="serif text-2xl">Condition and handover</h2><p className="mt-1 text-sm text-muted-foreground">A clear picture of condition makes a good handover.</p></div>
          <FormField control={form.control} name="condition" render={({ field }) => <FormItem className="mt-5"><FormLabel>Book condition <RequiredMark /></FormLabel><FormControl><div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Book condition">
            {conditionChoices.map((choice) => <button key={choice.value} type="button" aria-pressed={field.value === choice.value} onClick={() => field.onChange(choice.value)} className={`min-h-[82px] rounded-xl border p-3 text-left transition-colors ${field.value === choice.value ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border hover:bg-secondary/60'}`} data-testid={`button-condition-${choice.value}`}><span className="block text-sm font-semibold">{choice.label}</span><span className="mt-1 block text-xs leading-4 text-muted-foreground">{choice.description}</span></button>)}
          </div></FormControl><FormMessage /></FormItem>} />
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <FormField control={form.control} name="area_name" render={({ field }) => <FormItem><FormLabel>Town or handover area <RequiredMark /></FormLabel><FormControl><Input placeholder="Narok, Kilimani, Westlands…" maxLength={80} data-testid="input-book-area" {...field} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="personal_note" render={({ field }) => <FormItem><FormLabel>Personal note <span className="font-normal text-muted-foreground">(optional)</span></FormLabel><FormControl><Input placeholder="A little note for the next reader" maxLength={280} data-testid="input-book-note" {...field} /></FormControl><FormMessage /></FormItem>} />
          </div>
          <FormField control={form.control} name="accepts_credits" render={({ field }) => <FormItem className="mt-5"><div className="flex items-start gap-3 rounded-xl border border-border bg-background/60 p-4"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-accept-credits" /></FormControl><div><FormLabel className="cursor-pointer">I’m open to receiving swap credits for this book</FormLabel><p className="mt-1 text-xs leading-5 text-muted-foreground">This is optional. You can update your preference later.</p></div></div><FormMessage /></FormItem>} />
        </section>

        <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm sm:p-8">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><ImagePlus size={19} /></span><div><h2 className="serif text-2xl">Condition photos</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Up to three photos of this copy. Images are compressed before upload.</p></div></div>
          {existingPhotoCount > 0 && <p className="mt-4 text-sm text-muted-foreground" data-testid="status-existing-photos">{existingPhotoCount} photo{existingPhotoCount === 1 ? '' : 's'} already saved. Existing photos stay with this listing.</p>}
          {selectedPhotos.length > 0 && <div className="mt-4 grid grid-cols-3 gap-3">
            {selectedPhotos.map(({ file, preview }, index) => <div key={preview} className="relative aspect-square overflow-hidden rounded-xl border border-border"><img src={preview} alt={`Preview of ${file.name}`} className="h-full w-full object-cover" data-testid={`img-photo-preview-${index}`} /><button type="button" onClick={() => removePhoto(preview)} aria-label={`Remove ${file.name}`} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-foreground/80 text-background" data-testid={`button-remove-photo-${index}`}><X size={16} /></button></div>)}
          </div>}
          {photoError && <p role="alert" className="mt-3 text-sm text-destructive" data-testid="status-photo-error">{photoError}</p>}
          {selectedPhotos.length + existingPhotoCount < 3 && <div className="mt-4">
            <input ref={photoInput} type="file" accept="image/*" multiple className="sr-only" onChange={(event) => addPhotos(event.target.files)} aria-label="Choose condition photos" data-testid="input-book-photos" />
            <Button type="button" variant="outline" onClick={() => photoInput.current?.click()} className="rounded-xl" data-testid="button-choose-photos"><Upload size={16} className="mr-2" />Choose photos<span className="ml-1 text-xs text-muted-foreground">({3 - existingPhotoCount - selectedPhotos.length} left)</span></Button>
          </div>}
        </section>

        <div className="sticky bottom-[82px] z-20 rounded-2xl border border-border bg-background/95 p-3 shadow-sm backdrop-blur-md md:bottom-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground"><ShieldCheck size={15} className="shrink-0 text-primary" />Your listing is saved to your account, not published as a demo.</p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => navigate('/shelf')} className="flex-1 rounded-xl sm:flex-none" data-testid="button-cancel-book">Cancel</Button>
              <Button type="submit" disabled={saving || !isSupabaseConfigured} className="flex-1 rounded-xl sm:min-w-40 sm:flex-none" data-testid="button-save-book">{saving ? <LoaderCircle size={16} className="mr-2 animate-spin" /> : <Check size={16} className="mr-2" />}{editId || savedBookId ? 'Save changes' : 'Save listing'}</Button>
            </div>
          </div>
          {feedback?.kind === 'success' && savedBookId && <Link href="/shelf" className="mt-2 inline-flex items-center gap-1 px-1 text-xs font-semibold text-primary hover:underline" data-testid="link-saved-book-shelf">View it on My Shelf <ArrowRight size={13} /></Link>}
        </div>
      </form>
    </Form>}
    {savedBook && !feedback && <span className="sr-only" data-testid="text-saved-book-id">{savedBook.id}</span>}
  </div>;
}

function RequiredMark() { return <><span aria-hidden="true" className="text-accent">*</span><span className="sr-only"> required</span></>; }
function bookToValues(book: Book): ListingValues {
  return {
    title: book.title ?? '',
    author: book.author ?? '',
    isbn: book.isbn ?? '',
    description: book.description ?? '',
    cover_url: book.cover_url ?? '',
    condition: book.condition,
    genre: book.genre ?? '',
    language: book.language || 'English',
    personal_note: book.personal_note ?? '',
    accepts_credits: book.accepts_credits,
    area_name: book.area_name ?? '',
  };
}
