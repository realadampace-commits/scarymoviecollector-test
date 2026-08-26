-- Allow forum owners to create posts alongside subscribers and moderators.
-- This preserves authenticated-user and profile-role checks.
drop policy if exists "forum posts insert by subs+" on public.forum_posts;
create policy "forum posts insert by subs+"
on public.forum_posts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = any (array['subscriber'::text, 'moderator'::text, 'owner'::text])
  )
);
