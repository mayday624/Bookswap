import { supabase } from '@/lib/supabase';

export type BookCondition = 'like_new' | 'good' | 'fair' | 'worn';
export type BookStatus = 'available' | 'reserved' | 'swapped';

export type BookPhoto = {
  id: string;
  book_id: string;
  storage_path: string;
  sort_order: number;
};

export type Book = {
  id: string;
  owner_id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  description: string | null;
  cover_url: string | null;
  condition: BookCondition;
  genre: string | null;
  language: string;
  personal_note: string | null;
  status: BookStatus;
  accepts_credits: boolean;
  area_name: string;
  created_at: string;
  updated_at: string;
  book_photos: BookPhoto[];
};

export type BookInput = {
  title: string;
  author: string;
  isbn: string;
  description: string;
  cover_url: string;
  condition: BookCondition;
  genre: string;
  language: string;
  personal_note: string;
  accepts_credits: boolean;
  area_name: string;
};

export type OpenLibraryBook = {
  title: string;
  author: string;
  isbn: string;
  description: string;
  coverUrl: string;
};

function getSupabase() {
  if (!supabase) throw new Error('Connect Supabase before managing book listings.');
  return supabase;
}

export async function listMyBooks(): Promise<Book[]> {
  const client = getSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error('Sign in to view your shelf.');

  const { data, error } = await client
    .from('books')
    .select('id, owner_id, title, author, isbn, description, cover_url, condition, genre, language, personal_note, status, accepts_credits, area_name, created_at, updated_at, book_photos(id, book_id, storage_path, sort_order)')
    .eq('owner_id', authData.user.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Your shelf could not be loaded: ${error.message}`);
  return (data ?? []) as Book[];
}

export async function saveBook(input: BookInput, bookId?: string): Promise<Book> {
  const client = getSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error('Sign in before saving a book.');

  const payload = {
    title: input.title.trim(),
    author: input.author.trim() || null,
    isbn: normalizeIsbn(input.isbn) || null,
    description: input.description.trim() || null,
    cover_url: input.cover_url.trim() || null,
    condition: input.condition,
    genre: input.genre.trim() || null,
    language: input.language.trim() || 'English',
    personal_note: input.personal_note.trim() || null,
    accepts_credits: input.accepts_credits,
    area_name: input.area_name.trim() || 'Nairobi',
  };

  const query = bookId
    ? client.from('books').update(payload).eq('id', bookId).eq('owner_id', authData.user.id)
    : client.from('books').insert({ ...payload, owner_id: authData.user.id });

  const { data, error } = await query
    .select('id, owner_id, title, author, isbn, description, cover_url, condition, genre, language, personal_note, status, accepts_credits, area_name, created_at, updated_at, book_photos(id, book_id, storage_path, sort_order)')
    .single();

  if (error || !data) throw new Error(`The book could not be saved: ${error?.message ?? 'No record returned.'}`);
  return data as Book;
}

export async function uploadBookPhotos(bookId: string, files: File[]): Promise<BookPhoto[]> {
  if (files.length === 0) return [];
  if (files.length > 3) throw new Error('Choose no more than three photos.');
  const client = getSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error('Sign in before uploading photos.');

  const { data: currentPhotos, error: photoQueryError } = await client
    .from('book_photos')
    .select('id, book_id, storage_path, sort_order')
    .eq('book_id', bookId)
    .order('sort_order');
  if (photoQueryError) throw new Error(`Existing photos could not be checked: ${photoQueryError.message}`);
  if ((currentPhotos?.length ?? 0) + files.length > 3) throw new Error('A book can have up to three photos.');

  const uploadedPaths: string[] = [];
  const inserted: Array<{ book_id: string; storage_path: string; sort_order: number }> = [];
  try {
    for (const [index, file] of files.entries()) {
      const compressed = await compressImage(file);
      const ext = compressed.type === 'image/webp' ? 'webp' : 'jpg';
      const storagePath = `${authData.user.id}/${bookId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await client.storage.from('book-photos').upload(storagePath, compressed, {
        contentType: compressed.type,
        upsert: false,
      });
      if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
      uploadedPaths.push(storagePath);
      inserted.push({
        book_id: bookId,
        storage_path: storagePath,
        sort_order: (currentPhotos?.length ?? 0) + index,
      });
    }

    const { data, error: insertError } = await client
      .from('book_photos')
      .insert(inserted)
      .select('id, book_id, storage_path, sort_order');
    if (insertError) throw new Error(`Photo details could not be saved: ${insertError.message}`);
    return (data ?? []) as BookPhoto[];
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await client.storage.from('book-photos').remove(uploadedPaths);
    }
    throw error;
  }
}

export async function deleteBook(bookId: string): Promise<{ cleanupWarning?: string }> {
  const client = getSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error('Sign in before removing a book.');

  const { data: requestedHistory, error: requestedHistoryError } = await client
    .from('swap_requests')
    .select('id')
    .eq('requested_book_id', bookId)
    .limit(1);
  if (requestedHistoryError) throw new Error(`The book’s request history could not be checked: ${requestedHistoryError.message}`);
  const { data: offeredHistory, error: offeredHistoryError } = await client
    .from('swap_requests')
    .select('id')
    .eq('offered_book_id', bookId)
    .limit(1);
  if (offeredHistoryError) throw new Error(`The book’s request history could not be checked: ${offeredHistoryError.message}`);
  if (requestedHistory?.length || offeredHistory?.length) {
    throw new Error('This listing has swap request history and cannot be removed. Contact the other reader to close the request first.');
  }

  const { data: activeRequested, error: requestedSwapError } = await client
    .from('swaps')
    .select('id')
    .eq('requested_book_id', bookId)
    .in('status', ['arranging', 'confirmed'])
    .limit(1);
  if (requestedSwapError) throw new Error(`The book’s swap status could not be checked: ${requestedSwapError.message}`);

  const { data: activeOffered, error: offeredSwapError } = await client
    .from('swaps')
    .select('id')
    .eq('offered_book_id', bookId)
    .in('status', ['arranging', 'confirmed'])
    .limit(1);
  if (offeredSwapError) throw new Error(`The book’s swap status could not be checked: ${offeredSwapError.message}`);
  if (activeRequested?.length || activeOffered?.length) {
    throw new Error('This book is part of an active swap and cannot be removed yet.');
  }

  const { data: photos, error: photosError } = await client
    .from('book_photos')
    .select('storage_path')
    .eq('book_id', bookId);
  if (photosError) throw new Error(`The book photos could not be loaded: ${photosError.message}`);

  const paths = (photos ?? []).map((photo) => photo.storage_path);
  const { data: removed, error } = await client
    .from('books')
    .delete()
    .eq('id', bookId)
    .eq('owner_id', authData.user.id)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(`The book could not be removed: ${error.message}`);
  if (!removed) throw new Error('This listing was not found on your shelf or you no longer have permission to remove it.');
  if (paths.length > 0) {
    const { error: storageError } = await client.storage.from('book-photos').remove(paths);
    if (storageError) return { cleanupWarning: `The listing was removed, but its stored photos still need cleanup: ${storageError.message}` };
  }
  return {};
}

export function getBookPhotoUrl(photo: BookPhoto): string | null {
  if (!supabase) return null;
  return supabase.storage.from('book-photos').getPublicUrl(photo.storage_path).data.publicUrl;
}

export async function lookupOpenLibrary(query: string): Promise<OpenLibraryBook | null> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return null;
  const isbn = normalizeIsbn(trimmed);
  if (/^(?:\d{9}[\dX]|\d{13})$/.test(isbn)) {
    const isbnUrl = new URL('https://openlibrary.org/api/books');
    isbnUrl.searchParams.set('bibkeys', `ISBN:${isbn}`);
    isbnUrl.searchParams.set('format', 'json');
    isbnUrl.searchParams.set('jscmd', 'data');
    const isbnResponse = await fetch(isbnUrl, { headers: { Accept: 'application/json' } });
    if (isbnResponse.ok) {
      const isbnData = (await isbnResponse.json()) as Record<string, {
        title?: string;
        authors?: Array<{ name?: string }>;
        identifiers?: { isbn_10?: string[]; isbn_13?: string[] };
        cover?: { medium?: string; small?: string };
        description?: string | { value?: string };
      }>;
      const record = Object.values(isbnData)[0];
      if (record?.title) {
        return {
          title: record.title,
          author: record.authors?.[0]?.name ?? '',
          isbn: record.identifiers?.isbn_13?.[0] ?? record.identifiers?.isbn_10?.[0] ?? isbn,
          description: typeof record.description === 'string' ? record.description : record.description?.value ?? '',
          coverUrl: record.cover?.medium ?? record.cover?.small ?? '',
        };
      }
    }
  }

  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set('q', trimmed);
  url.searchParams.set('limit', '5');
  url.searchParams.set('fields', 'title,author_name,isbn,cover_i,first_sentence');

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Open Library lookup is unavailable. You can enter the book details manually.');
  const result = (await response.json()) as {
    docs?: Array<{
      title?: string;
      author_name?: string[];
      isbn?: string[];
      cover_i?: number;
      first_sentence?: string[];
    }>;
  };
  const first = result.docs?.[0];
  if (!first?.title) return null;
  return {
    title: first.title,
    author: first.author_name?.[0] ?? '',
    isbn: first.isbn?.[0] ?? '',
    description: first.first_sentence?.[0] ?? '',
    coverUrl: first.cover_i ? `https://covers.openlibrary.org/b/id/${first.cover_i}-M.jpg` : '',
  };
}

export function normalizeIsbn(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

export async function scanIsbn(): Promise<string | null> {
  const BarcodeDetectorConstructor = (
    window as Window & {
      BarcodeDetector?: new (options?: { formats: string[] }) => {
        detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
      };
    }
  ).BarcodeDetector;

  if (!BarcodeDetectorConstructor || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('ISBN scanning is not supported on this browser. You can enter the ISBN or title instead.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  const video = document.createElement('video');
  video.srcObject = stream;
  video.playsInline = true;
  try {
    await video.play();
    const detector = new BarcodeDetectorConstructor({ formats: ['ean_13', 'ean_8'] });
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const [barcode] = await detector.detect(video);
        if (barcode?.rawValue) return normalizeIsbn(barcode.rawValue);
      }
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
    throw new Error('No barcode found. Try again or enter the ISBN manually.');
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}

async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  if (!('createImageBitmap' in window)) throw new Error('Image compression is not supported in this browser.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This photo could not be prepared. Try another image.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
  if (webp) return webp;
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!jpeg) throw new Error('This photo could not be compressed. Try another image.');
  return jpeg;
}
