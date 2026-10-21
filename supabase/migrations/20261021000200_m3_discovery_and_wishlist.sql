create or replace function public.search_nearby_books(
  p_query text default null,
  p_genre text default null,
  p_condition public.book_condition default null,
  p_language text default null,
  p_area text default null,
  p_distance_km integer default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  owner_id uuid,
  title text,
  author text,
  isbn text,
  description text,
  cover_url text,
  condition public.book_condition,
  genre text,
  language text,
  personal_note text,
  status public.book_status,
  accepts_credits boolean,
  area_name text,
  area_lat numeric,
  area_lng numeric,
  created_at timestamptz,
  distance_km double precision
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  safe_lat double precision;
  safe_lng double precision;
begin
  if p_distance_km is not null and p_distance_km not in (5, 20, 50) then
    raise exception 'Distance must be 5, 20, 50, or null.';
  end if;
  if (p_lat is null) <> (p_lng is null) then
    raise exception 'Both approximate coordinates must be provided together.';
  end if;

  safe_lat := case when p_lat is null then null else round(p_lat::numeric, 2)::double precision end;
  safe_lng := case when p_lng is null then null else round(p_lng::numeric, 2)::double precision end;

  return query
  with candidates as (
    select b.id, b.owner_id, b.title, b.author, b.isbn, b.description, b.cover_url,
      b.condition, b.genre, b.language, b.personal_note, b.status, b.accepts_credits,
      b.area_name, b.area_lat, b.area_lng, b.created_at,
      case
        when safe_lat is null or b.area_lat is null or b.area_lng is null then null
        else 6371.0 * 2.0 * asin(sqrt(least(1.0,
          power(sin(radians(b.area_lat::double precision - safe_lat) / 2.0), 2)
          + cos(radians(safe_lat)) * cos(radians(b.area_lat::double precision))
          * power(sin(radians(b.area_lng::double precision - safe_lng) / 2.0), 2)
        )))
      end as calculated_distance
    from public.books b
    where b.status = 'available'
      and public.is_active_user(b.owner_id)
      and (nullif(trim(p_query), '') is null or
        (b.title || ' ' || coalesce(b.author, '')) ilike '%' || trim(p_query) || '%')
      and (nullif(trim(p_genre), '') is null or b.genre ilike trim(p_genre))
      and (p_condition is null or b.condition = p_condition)
      and (nullif(trim(p_language), '') is null or b.language ilike trim(p_language))
      and (nullif(trim(p_area), '') is null or b.area_name ilike '%' || trim(p_area) || '%')
  )
  select c.id, c.owner_id, c.title, c.author, c.isbn, c.description, c.cover_url,
    c.condition, c.genre, c.language, c.personal_note, c.status, c.accepts_credits,
    c.area_name, c.area_lat, c.area_lng, c.created_at, c.calculated_distance
  from candidates c
  where p_distance_km is null
    or (c.calculated_distance is not null and c.calculated_distance <= p_distance_km)
  order by c.calculated_distance nulls last, c.created_at desc
  limit least(100, greatest(1, coalesce(p_limit, 50)));
end;
$$;

create or replace function public.get_public_profile_summary(target_user_id uuid)
returns table (
  average_rating numeric,
  rating_count integer,
  completed_swaps integer,
  trusted_swapper boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with rating_summary as (
    select round(avg(r.stars)::numeric, 2) as average_rating, count(*)::integer as rating_count
    from public.ratings r
    where r.rated_user_id = target_user_id
  ),
  swap_summary as (
    select count(*)::integer as completed_swaps
    from public.swaps s
    where s.status = 'completed'
      and (s.requester_id = target_user_id or s.owner_id = target_user_id)
  )
  select rs.average_rating, rs.rating_count, ss.completed_swaps,
    (ss.completed_swaps >= 5 and coalesce(rs.average_rating, 0) >= 4.0)
  from rating_summary rs cross join swap_summary ss
  where exists (select 1 from public.profiles p where p.id = target_user_id and p.is_suspended = false);
$$;

grant execute on function public.search_nearby_books(text, text, public.book_condition, text, text, integer, double precision, double precision, integer)
  to anon, authenticated;
grant execute on function public.get_public_profile_summary(uuid) to anon, authenticated;
