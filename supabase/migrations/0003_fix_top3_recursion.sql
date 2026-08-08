-- The anon top3 policy subquery referenced `requests` from inside its own
-- USING clause, which re-triggers the same policy for the inner query and
-- causes Postgres to raise "infinite recursion detected in policy"
-- (42P17) on every anon SELECT. Move the ranking subquery into a
-- SECURITY DEFINER function (owned by postgres, which bypasses RLS) so the
-- inner scan doesn't re-evaluate the anon policy.

drop policy if exists "requests_select_public_top3" on requests;

create or replace function public.top3_pending_song_keys(p_event_id uuid)
returns table (song_key text)
language sql
security definer
set search_path = public
stable
as $$
  select lower(trim(title)) || '::' || lower(trim(artist)) as song_key
  from requests
  where event_id = p_event_id
    and is_vip = false
    and status = 'pending'
  group by lower(trim(title)), lower(trim(artist))
  order by sum(amount) desc, count(*) desc
  limit 3
$$;

revoke all on function public.top3_pending_song_keys(uuid) from public;
grant execute on function public.top3_pending_song_keys(uuid) to anon, authenticated;

create policy "requests_select_public_top3" on requests
  for select
  to anon
  using (
    is_vip = false
    and status = 'pending'
    and (lower(trim(title)) || '::' || lower(trim(artist))) in (
      select song_key from public.top3_pending_song_keys(requests.event_id)
    )
  );
