import { getBookPhotoUrl, normalizeIsbn, type BookCondition, type BookPhoto } from '@/features/books/api';
import { supabase } from '@/lib/supabase';

export type DiscoverFilters = {
  query: string;
  genre: string;
  condition: BookCondition | '';
  language: string;
  area: string;
  distanceKm: 5 | 20 | 50 | null;
  latitude: number | null;
  longitude: number | null;
};

export type ReaderSummary = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  area: string;
  town: string;
};

export type NearbyBook = {
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
  status: 'available' | 'reserved' | 'swapped';
  accepts_credits: boolean;
  area_name: string;
  created_at: string;
  distance_km: number | null;
  owner: ReaderSummary | null;
  photos: BookPhoto[];
};

export type BookDetail = NearbyBook & {
  average_rating: number | null;
  rating_count: number;
  completed_swaps: number;
  trusted_swapper: boolean;
};

export type WishlistItem = {
  id: string;
  user_id: string;
  title: string | null;
  author: string | null;
  isbn: string | null;
  genre: string | null;
  created_at: string;
  updated_at: string;
};

export type WishlistInput = {
  title: string;
  author: string;
  isbn: string;
  genre: string;
};

function getClient() {
  if (!supabase) throw new Error('Connect Supabase before using Discover.');
  return supabase;
}

export async function listDiscoverBooks(filters: DiscoverFilters): Promise<NearbyBook[]> {
  const client = getClient();
  const { data: authData } = await client.auth.getUser();
  const { data: rows, error } = await client.rpc('search_nearby_books', {
    p_query: filters.query.trim() || null,
    p_genre: filters.genre.trim() || null,
    p_condition: filters.condition || null,
    p_language: filters.language.trim() || null,
    p_area: filters.area.trim() || null,
    p_distance_km: filters.distanceKm,
    p_lat: filters.latitude,
    p_lng: filters.longitude,
    p_limit: 100,
  });
  if (error) throw new Error(`Nearby books could not be loaded: ${error.message}`);
  const books = (rows ?? []) as Omit<NearbyBook, 'owner' | 'photos'>[];

  const hiddenIds = new Set<string>();
  if (authData.user && books.length) {
    const [blocksResult, reportsResult] = await Promise.all([
      client.from('blocks').select('blocked_id').eq('blocker_id', authData.user.id),
      client.from('reports').select('reported_user_id').eq('reporter_id', authData.user.id),
    ]);
    if (blocksResult.error) throw new Error(`Blocked readers could not be filtered: ${blocksResult.error.message}`);
    if (reportsResult.error) throw new Error(`Reported readers could not be filtered: ${reportsResult.error.message}`);
    for (const block of blocksResult.data ?? []) hiddenIds.add(block.blocked_id);
    for (const report of reportsResult.data ?? []) hiddenIds.add(report.reported_user_id);
  }
  const visibleBooks = books.filter((book) => !hiddenIds.has(book.owner_id));
  if (!visibleBooks.length) return [];

  const ownerIds = [...new Set(visibleBooks.map((book) => book.owner_id))];
  const bookIds = visibleBooks.map((book) => book.id);
  const [profilesResult, photosResult] = await Promise.all([
    client.from('profiles').select('id, username, display_name, avatar_url, area, town').in('id', ownerIds),
    client.from('book_photos').select('id, book_id, storage_path, sort_order').in('book_id', bookIds).order('sort_order'),
  ]);
  if (profilesResult.error) throw new Error(`Reader profiles could not be loaded: ${profilesResult.error.message}`);
  if (photosResult.error) throw new Error(`Book photos could not be loaded: ${photosResult.error.message}`);

  const profilesById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile as ReaderSummary]));
  const photosByBook = new Map<string, BookPhoto[]>();
  for (const photo of photosResult.data ?? []) {
    const list = photosByBook.get(photo.book_id) ?? [];
    list.push(photo as BookPhoto);
    photosByBook.set(photo.book_id, list);
  }
  return visibleBooks.map((book) => ({
    ...book,
    owner: profilesById.get(book.owner_id) ?? null,
    photos: photosByBook.get(book.id) ?? [],
  }));
}

export async function getDiscoverBook(bookId: string): Promise<BookDetail> {
  const client = getClient();
  const { data: authData } = await client.auth.getUser();
  const { data: book, error } = await client
    .from('books')
    .select('id, owner_id, title, author, isbn, description, cover_url, condition, genre, language, personal_note, status, accepts_credits, area_name, created_at')
    .eq('id', bookId)
    .maybeSingle();
  if (error) throw new Error(`This listing could not be loaded: ${error.message}`);
  if (!book) throw new Error('This book is no longer available to view.');
  if (authData.user) {
    const [blockResult, reportResult] = await Promise.all([
      client.from('blocks').select('blocked_id').eq('blocker_id', authData.user.id).eq('blocked_id', book.owner_id).maybeSingle(),
      client.from('reports').select('reported_user_id').eq('reporter_id', authData.user.id).eq('reported_user_id', book.owner_id).limit(1),
    ]);
    if (blockResult.error) throw new Error(`The listing could not be checked: ${blockResult.error.message}`);
    if (reportResult.error) throw new Error(`The listing could not be checked: ${reportResult.error.message}`);
    if (blockResult.data || reportResult.data?.length) throw new Error('This listing is no longer available to you.');
  }

  const [profileResult, photosResult, summaryResult] = await Promise.all([
    client.from('profiles').select('id, username, display_name, avatar_url, area, town').eq('id', book.owner_id).maybeSingle(),
    client.from('book_photos').select('id, book_id, storage_path, sort_order').eq('book_id', book.id).order('sort_order'),
    client.rpc('get_public_profile_summary', { target_user_id: book.owner_id }),
  ]);
  if (profileResult.error) throw new Error(`The reader profile could not be loaded: ${profileResult.error.message}`);
  if (photosResult.error) throw new Error(`Book photos could not be loaded: ${photosResult.error.message}`);
  if (summaryResult.error) throw new Error(`The reader rating could not be loaded: ${summaryResult.error.message}`);

  const summary = (summaryResult.data?.[0] ?? null) as {
    average_rating: number | null;
    rating_count: number;
    completed_swaps: number;
    trusted_swapper: boolean;
  } | null;
  return {
    ...book,
    distance_km: null,
    owner: profileResult.data as ReaderSummary | null,
    photos: (photosResult.data ?? []) as BookPhoto[],
    ...summary,
  } as BookDetail;
}

export function getPublicBookPhotoUrl(photo: BookPhoto): string | null {
  return getBookPhotoUrl(photo);
}

export async function listWishlist(): Promise<WishlistItem[]> {
  const client = getClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error('Sign in to manage your wishlist.');
  const { data, error } = await client
    .from('wishlist_items')
    .select('id, user_id, title, author, isbn, genre, created_at, updated_at')
    .eq('user_id', authData.user.id)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Your wishlist could not be loaded: ${error.message}`);
  return (data ?? []) as WishlistItem[];
}

export async function saveWishlistItem(input: WishlistInput, itemId?: string): Promise<WishlistItem> {
  const client = getClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error('Sign in before saving a wishlist item.');
  const title = input.title.trim();
  const genre = input.genre.trim();
  const isbn = normalizeIsbn(input.isbn);
  if (!title && !genre && !isbn) throw new Error('Add a title, ISBN, or genre wish.');

  const payload = {
    title: title || null,
    author: input.author.trim() || null,
    isbn: isbn || null,
    genre: genre || null,
  };
  const query = itemId
    ? client.from('wishlist_items').update(payload).eq('id', itemId).eq('user_id', authData.user.id)
    : client.from('wishlist_items').insert({ ...payload, user_id: authData.user.id });
  const { data, error } = await query
    .select('id, user_id, title, author, isbn, genre, created_at, updated_at')
    .single();
  if (error || !data) throw new Error(`The wishlist item could not be saved: ${error?.message ?? 'No record returned.'}`);
  return data as WishlistItem;
}

export async function deleteWishlistItem(itemId: string): Promise<void> {
  const client = getClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error('Sign in before removing a wishlist item.');
  const { data, error } = await client
    .from('wishlist_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', authData.user.id)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(`The wishlist item could not be removed: ${error.message}`);
  if (!data) throw new Error('That wishlist item is no longer available to remove.');
}

export async function getMyApproximateLocation(): Promise<{ latitude: number | null; longitude: number | null; area: string }> {
  const client = getClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return { latitude: null, longitude: null, area: '' };
  const { data, error } = await client
    .from('profiles')
    .select('area_lat, area_lng, area, town')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (error) throw new Error(`Your area could not be loaded: ${error.message}`);
  return {
    latitude: data?.area_lat === null || data?.area_lat === undefined ? null : Number(data.area_lat),
    longitude: data?.area_lng === null || data?.area_lng === undefined ? null : Number(data.area_lng),
    area: data?.area || data?.town || '',
  };
}

export async function saveApproximateBrowserLocation(): Promise<{ latitude: number; longitude: number }> {
  if (!navigator.geolocation) throw new Error('Location is not available in this browser. You can still search anywhere.');
  const client = getClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error('Sign in to save an approximate area.');
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 300000,
      timeout: 10000,
    });
  });
  const latitude = Math.round(position.coords.latitude * 100) / 100;
  const longitude = Math.round(position.coords.longitude * 100) / 100;
  const { error } = await client
    .from('profiles')
    .update({ area_lat: latitude, area_lng: longitude })
    .eq('id', authData.user.id);
  if (error) throw new Error(`Approximate location could not be saved: ${error.message}`);
  return { latitude, longitude };
}
