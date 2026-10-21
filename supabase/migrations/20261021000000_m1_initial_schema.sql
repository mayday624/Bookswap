create extension if not exists pgcrypto with schema extensions;

create type public.book_condition as enum ('like_new', 'good', 'fair', 'worn');
create type public.book_status as enum ('available', 'reserved', 'swapped');
create type public.swap_request_status as enum ('pending', 'accepted', 'declined', 'countered', 'cancelled');
create type public.swap_status as enum ('arranging', 'confirmed', 'completed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_-]{3,30}$'),
  display_name text not null default 'Reader' check (char_length(display_name) between 1 and 60),
  avatar_url text,
  bio text check (char_length(bio) <= 280),
  town text not null default 'Nairobi' check (char_length(town) between 1 and 80),
  area text not null default 'Nairobi' check (char_length(area) between 1 and 100),
  favorite_genres text[] not null default '{}',
  area_lat numeric(6,2),
  area_lng numeric(6,2),
  is_admin boolean not null default false,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((area_lat is null) = (area_lng is null)),
  check (area_lat is null or area_lat between -90 and 90),
  check (area_lng is null or area_lng between -180 and 180)
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  author text check (char_length(author) <= 160),
  isbn text check (isbn is null or isbn ~ '^[0-9Xx -]{10,20}$'),
  description text check (char_length(description) <= 3000),
  cover_url text,
  condition public.book_condition not null default 'good',
  genre text,
  language text not null default 'English',
  personal_note text check (char_length(personal_note) <= 500),
  status public.book_status not null default 'available',
  accepts_credits boolean not null default false,
  area_name text not null default 'Nairobi' check (char_length(area_name) between 1 and 100),
  area_lat numeric(6,2),
  area_lng numeric(6,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((area_lat is null) = (area_lng is null)),
  check (area_lat is null or area_lat between -90 and 90),
  check (area_lng is null or area_lng between -180 and 180)
);

create table public.book_photos (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  storage_path text not null unique,
  sort_order smallint not null default 0 check (sort_order between 0 and 2),
  created_at timestamptz not null default now(),
  unique (book_id, sort_order)
);

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  author text,
  isbn text,
  genre text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(trim(title), '') is not null or nullif(trim(genre), '') is not null or nullif(trim(isbn), '') is not null)
);

create table public.swap_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  requested_book_id uuid not null references public.books(id) on delete restrict,
  offered_book_id uuid references public.books(id) on delete set null,
  uses_credit boolean not null default false,
  status public.swap_request_status not null default 'pending',
  message text check (char_length(message) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> owner_id),
  check ((offered_book_id is null) = uses_credit)
);

create table public.swaps (
  id uuid primary key default gen_random_uuid(),
  request_id uuid unique references public.swap_requests(id) on delete set null,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  requested_book_id uuid references public.books(id) on delete set null,
  offered_book_id uuid references public.books(id) on delete set null,
  uses_credit boolean not null default false,
  status public.swap_status not null default 'arranging',
  meeting_area text check (char_length(meeting_area) <= 160),
  meeting_time timestamptz,
  requester_confirmed_at timestamptz,
  owner_confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> owner_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  swap_id uuid not null references public.swaps(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount smallint not null check (amount <> 0),
  reason text not null,
  swap_id uuid references public.swaps(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  swap_id uuid not null references public.swaps(id) on delete cascade,
  rater_id uuid not null references public.profiles(id) on delete cascade,
  rated_user_id uuid not null references public.profiles(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (swap_id, rater_id),
  check (rater_id <> rated_user_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  swap_id uuid references public.swaps(id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 100),
  details text check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index books_owner_status_idx on public.books (owner_id, status);
create index books_area_status_idx on public.books (area_name, status);
create index books_created_at_idx on public.books (created_at desc);
create index wishlist_items_user_idx on public.wishlist_items (user_id, created_at desc);
create index swap_requests_owner_status_idx on public.swap_requests (owner_id, status);
create index swap_requests_requester_status_idx on public.swap_requests (requester_id, status);
create index swaps_participants_status_idx on public.swaps (requester_id, owner_id, status);
create index messages_swap_created_idx on public.messages (swap_id, created_at);
create index credit_transactions_user_created_idx on public.credit_transactions (user_id, created_at desc);
create index ratings_rated_user_idx on public.ratings (rated_user_id, created_at desc);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index reports_status_created_idx on public.reports (status, created_at desc);

create or replace function public.is_active_user(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = target_user_id and p.is_suspended = false
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true and p.is_suspended = false
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
begin
  requested_username := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  requested_username := regexp_replace(requested_username, '[^a-z0-9_-]', '', 'g');
  if char_length(requested_username) < 3 or char_length(requested_username) > 30 then
    requested_username := 'reader-' || substr(new.id::text, 1, 8);
  end if;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    requested_username,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Reader'), 60)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'service_role') then
    new.id := old.id;
    new.is_admin := old.is_admin;
    new.is_suspended := old.is_suspended;
  end if;
  return new;
end;
$$;

create or replace function public.guard_book_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'service_role') then
    new.id := old.id;
    new.owner_id := old.owner_id;
    new.status := old.status;
  end if;
  return new;
end;
$$;

create or replace function public.get_credit_balance()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(ct.amount), 0)::integer
  from public.credit_transactions ct
  where ct.user_id = auth.uid();
$$;

create trigger auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();
create trigger books_set_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();
create trigger books_guard_state
  before update on public.books
  for each row execute function public.guard_book_state();
create trigger wishlist_items_set_updated_at
  before update on public.wishlist_items
  for each row execute function public.set_updated_at();
create trigger swap_requests_set_updated_at
  before update on public.swap_requests
  for each row execute function public.set_updated_at();
create trigger swaps_set_updated_at
  before update on public.swaps
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.book_photos enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.swap_requests enable row level security;
alter table public.swaps enable row level security;
alter table public.messages enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.ratings enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;

create policy "public profiles are visible unless suspended"
  on public.profiles for select to anon, authenticated
  using (is_suspended = false or id = auth.uid());
create policy "users create their own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid() and is_suspended = false and is_admin = false);
create policy "users update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_active_user())
  with check (id = auth.uid() and public.is_active_user());

create policy "available books from active users are public"
  on public.books for select to anon, authenticated
  using (
    (status = 'available' and public.is_active_user(owner_id))
    or owner_id = auth.uid()
  );
create policy "active users create their own books"
  on public.books for insert to authenticated
  with check (owner_id = auth.uid() and public.is_active_user());
create policy "owners update their own books"
  on public.books for update to authenticated
  using (owner_id = auth.uid() and public.is_active_user())
  with check (owner_id = auth.uid() and public.is_active_user());
create policy "owners delete their own books"
  on public.books for delete to authenticated
  using (owner_id = auth.uid());

create policy "photos follow their book visibility"
  on public.book_photos for select to anon, authenticated
  using (
    exists (
      select 1 from public.books b
      where b.id = book_id and (b.status = 'available' or b.owner_id = auth.uid())
    )
  );
create policy "book owners add photos"
  on public.book_photos for insert to authenticated
  with check (
    exists (select 1 from public.books b where b.id = book_id and b.owner_id = auth.uid())
  );
create policy "book owners update photos"
  on public.book_photos for update to authenticated
  using (exists (select 1 from public.books b where b.id = book_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.books b where b.id = book_id and b.owner_id = auth.uid()));
create policy "book owners delete photos"
  on public.book_photos for delete to authenticated
  using (exists (select 1 from public.books b where b.id = book_id and b.owner_id = auth.uid()));

create policy "users manage their own wishlist"
  on public.wishlist_items for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_active_user());

create policy "swap participants read requests"
  on public.swap_requests for select to authenticated
  using (requester_id = auth.uid() or owner_id = auth.uid());
create policy "active users create swap requests"
  on public.swap_requests for insert to authenticated
  with check (
    requester_id = auth.uid()
    and public.is_active_user()
    and exists (
      select 1 from public.books b
      where b.id = requested_book_id and b.owner_id = owner_id and b.status = 'available'
    )
    and (offered_book_id is null or exists (
      select 1 from public.books b
      where b.id = offered_book_id and b.owner_id = auth.uid() and b.status = 'available'
    ))
  );
create policy "swap participants read swaps"
  on public.swaps for select to authenticated
  using (requester_id = auth.uid() or owner_id = auth.uid());

create policy "swap participants read messages"
  on public.messages for select to authenticated
  using (exists (
    select 1 from public.swaps s
    where s.id = swap_id and (s.requester_id = auth.uid() or s.owner_id = auth.uid())
  ));
create policy "active swap participants send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_active_user()
    and exists (
      select 1 from public.swaps s
      where s.id = swap_id and s.status in ('arranging', 'confirmed')
        and (s.requester_id = auth.uid() or s.owner_id = auth.uid())
    )
  );

create policy "users read their credit history"
  on public.credit_transactions for select to authenticated
  using (user_id = auth.uid());

create policy "ratings are public"
  on public.ratings for select to anon, authenticated
  using (true);
create policy "users rate the other party after a completed swap"
  on public.ratings for insert to authenticated
  with check (
    rater_id = auth.uid()
    and exists (
      select 1 from public.swaps s
      where s.id = swap_id and s.status = 'completed'
        and (
          (s.requester_id = auth.uid() and s.owner_id = rated_user_id)
          or (s.owner_id = auth.uid() and s.requester_id = rated_user_id)
        )
    )
  );

create policy "users read their notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "users mark their notifications read"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "reporters and admins read reports"
  on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());
create policy "active users submit reports"
  on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_active_user());

create policy "users manage their own blocks"
  on public.blocks for all to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid() and public.is_active_user());

grant select (id, username, display_name, avatar_url, bio, town, area, favorite_genres, area_lat, area_lng, created_at, updated_at)
  on public.profiles to anon, authenticated;
grant insert (id, username, display_name, avatar_url, bio, town, area, favorite_genres, area_lat, area_lng)
  on public.profiles to authenticated;
grant update (username, display_name, avatar_url, bio, town, area, favorite_genres, area_lat, area_lng)
  on public.profiles to authenticated;
grant select on public.books to anon, authenticated;
grant insert (owner_id, title, author, isbn, description, cover_url, condition, genre, language, personal_note, accepts_credits, area_name, area_lat, area_lng)
  on public.books to authenticated;
grant update (title, author, isbn, description, cover_url, condition, genre, language, personal_note, accepts_credits, area_name, area_lat, area_lng)
  on public.books to authenticated;
grant delete on public.books to authenticated;
grant select on public.book_photos to anon, authenticated;
grant insert, update, delete on public.book_photos to authenticated;
grant select, insert, update, delete on public.wishlist_items to authenticated;
grant select, insert on public.swap_requests to authenticated;
grant select on public.swaps to authenticated;
grant select, insert on public.messages to authenticated;
grant select on public.credit_transactions to authenticated;
grant select on public.ratings to anon, authenticated;
grant insert on public.ratings to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert on public.reports to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant execute on function public.is_active_user(uuid) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.get_credit_balance() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-photos', 'book-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "book photos are publicly readable"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'book-photos');
create policy "users upload into their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'book-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "users update their own photo files"
  on storage.objects for update to authenticated
  using (bucket_id = 'book-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'book-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete their own photo files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'book-photos' and (storage.foldername(name))[1] = auth.uid()::text);
