create extension if not exists pg_trgm with schema extensions;

create index books_isbn_lookup_idx
  on public.books (isbn)
  where isbn is not null;

create index books_title_author_trgm_idx
  on public.books
  using gin ((coalesce(title, '') || ' ' || coalesce(author, '')) extensions.gin_trgm_ops);

create index book_photos_book_order_idx
  on public.book_photos (book_id, sort_order);
